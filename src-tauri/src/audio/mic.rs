//! Microphone capture — cpal input on a dedicated thread, drain on tokio.

use std::sync::mpsc::{self, Sender};
use std::thread::{self, JoinHandle};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};

use crate::error::CaptureError;
use crate::ipc::commands::{ai_send_audio_impl, AiState, MicGateState};
use crate::settings::SettingsState;

const TARGET_RATE: u32 = 24_000;
const SAMPLES_PER_CHUNK: usize = (TARGET_RATE / 10) as usize;
const BYTES_PER_CHUNK: usize = SAMPLES_PER_CHUNK * 2;

#[derive(Debug, Clone, Serialize)]
pub struct MicLevel {
    pub rms_db: f32,
}

/// Send-safe handle; dropping it stops capture.
pub struct MicCapture {
    stop_tx: Sender<()>,
    thread: Option<JoinHandle<()>>,
}

impl Drop for MicCapture {
    fn drop(&mut self) {
        let _ = self.stop_tx.send(());
        if let Some(h) = self.thread.take() {
            let _ = h.join();
        }
    }
}

pub async fn start_capture(app: AppHandle) -> Result<MicCapture, CaptureError> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or(CaptureError::NoInputDevice)?;

    let supported = device
        .default_input_config()
        .map_err(|e| CaptureError::AudioConfig(e.to_string()))?;

    let sample_format = supported.sample_format();
    let config: StreamConfig = supported.into();
    let device_rate = config.sample_rate.0;
    let channels = config.channels as usize;

    let (sample_tx, sample_rx) = unbounded_channel::<Vec<f32>>();
    let app_drain = app.clone();
    tokio::spawn(async move {
        run_drain(app_drain, sample_rx, device_rate).await;
    });

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let sample_tx_thread = sample_tx.clone();

    let thread = thread::spawn(move || {
        let stream_result = build_input_stream(&device, &config, sample_format, channels, sample_tx_thread);
        let stream = match stream_result {
            Ok(s) => s,
            Err(e) => {
                log::error!("mic: failed to build stream: {e}");
                return;
            }
        };
        if let Err(e) = stream.play() {
            log::error!("mic: stream.play failed: {e}");
            return;
        }
        log::info!(
            "mic: capture thread running — {} Hz, {} ch, format {:?}",
            device_rate,
            channels,
            sample_format
        );
        let _ = stop_rx.recv();
        drop(stream);
        log::info!("mic: capture thread stopped");
    });

    log::info!("mic: capture started (device_rate={device_rate})");

    Ok(MicCapture {
        stop_tx,
        thread: Some(thread),
    })
}

fn build_input_stream(
    device: &cpal::Device,
    config: &StreamConfig,
    sample_format: SampleFormat,
    channels: usize,
    tx: UnboundedSender<Vec<f32>>,
) -> Result<cpal::Stream, CaptureError> {
    match sample_format {
        SampleFormat::F32 => device
            .build_input_stream(
                config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    let mono = downmix_to_mono(data, channels);
                    let _ = tx.send(mono);
                },
                |err| log::error!("mic: cpal error: {err}"),
                None,
            )
            .map_err(|e| CaptureError::StreamBuildFailed(e.to_string())),
        SampleFormat::I16 => device
            .build_input_stream(
                config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    let mono = downmix_i16_to_f32(data, channels);
                    let _ = tx.send(mono);
                },
                |err| log::error!("mic: cpal error: {err}"),
                None,
            )
            .map_err(|e| CaptureError::StreamBuildFailed(e.to_string())),
        SampleFormat::U16 => device
            .build_input_stream(
                config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    let mono = downmix_u16_to_f32(data, channels);
                    let _ = tx.send(mono);
                },
                |err| log::error!("mic: cpal error: {err}"),
                None,
            )
            .map_err(|e| CaptureError::StreamBuildFailed(e.to_string())),
        other => Err(CaptureError::StreamBuildFailed(format!(
            "unsupported sample format: {other:?}"
        ))),
    }
}

fn downmix_to_mono(data: &[f32], channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return data.to_vec();
    }
    let frames = data.len() / channels;
    let mut out = Vec::with_capacity(frames);
    for frame in 0..frames {
        let mut acc = 0.0_f32;
        for c in 0..channels {
            acc += data[frame * channels + c];
        }
        out.push(acc / channels as f32);
    }
    out
}

fn downmix_i16_to_f32(data: &[i16], channels: usize) -> Vec<f32> {
    let frames = data.len() / channels;
    let mut out = Vec::with_capacity(frames);
    for frame in 0..frames {
        let mut acc = 0.0_f32;
        for c in 0..channels {
            acc += data[frame * channels + c] as f32 / 32768.0;
        }
        out.push(acc / channels as f32);
    }
    out
}

fn downmix_u16_to_f32(data: &[u16], channels: usize) -> Vec<f32> {
    let frames = data.len() / channels;
    let mut out = Vec::with_capacity(frames);
    for frame in 0..frames {
        let mut acc = 0.0_f32;
        for c in 0..channels {
            acc += (data[frame * channels + c] as f32 - 32768.0) / 32768.0;
        }
        out.push(acc / channels as f32);
    }
    out
}

fn f32_to_s16le_bytes(samples: &[f32], out: &mut Vec<u8>) {
    for &s in samples {
        let v = (s.clamp(-1.0, 1.0) * 32767.0).round() as i16;
        let bytes = v.to_le_bytes();
        out.push(bytes[0]);
        out.push(bytes[1]);
    }
}

fn rms_dbfs(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return -120.0;
    }
    let sum_sq: f64 = samples.iter().map(|&s| (s as f64) * (s as f64)).sum();
    let rms = (sum_sq / samples.len() as f64).sqrt() as f32;
    if rms <= 1e-7 {
        return -120.0;
    }
    20.0 * rms.log10()
}

/// Linear interpolation resample to exactly `out_len` frames.
fn resample_linear(input: &[f32], from_rate: u32, to_rate: u32, out_len: usize) -> Vec<f32> {
    if input.is_empty() {
        return vec![0.0; out_len];
    }
    if from_rate == to_rate && input.len() == out_len {
        return input.to_vec();
    }
    let mut out = Vec::with_capacity(out_len);
    let in_len = input.len();
    for i in 0..out_len {
        let src_pos = (i as f64) * (from_rate as f64) / (to_rate as f64);
        let idx = src_pos.floor() as usize;
        let frac = (src_pos - idx as f64) as f32;
        let a = input[idx.min(in_len - 1)];
        let b = input[(idx + 1).min(in_len - 1)];
        out.push(a + (b - a) * frac);
    }
    out
}

async fn run_drain(
    app: AppHandle,
    mut rx: UnboundedReceiver<Vec<f32>>,
    device_rate: u32,
) {
    let ai_state: tauri::State<'_, AiState> = app.state::<AiState>();
    let ai_handle = std::sync::Arc::new(AiState(std::sync::Mutex::new(
        ai_state.0.lock().expect("ai mutex poisoned").clone(),
    )));

    let device_chunk_frames = (device_rate as usize).max(TARGET_RATE as usize) / 10;
    let mut accumulator: Vec<f32> = Vec::with_capacity(device_chunk_frames * 2);

    while let Some(buf) = rx.recv().await {
        accumulator.extend_from_slice(&buf);

        while accumulator.len() >= device_chunk_frames {
            let work: Vec<f32> = accumulator.drain(..device_chunk_frames).collect();
            let mut pcm_f32 = if device_rate == TARGET_RATE {
                work
            } else {
                resample_linear(&work, device_rate, TARGET_RATE, SAMPLES_PER_CHUNK)
            };

            if pcm_f32.len() != SAMPLES_PER_CHUNK {
                pcm_f32.resize(SAMPLES_PER_CHUNK, 0.0);
                pcm_f32.truncate(SAMPLES_PER_CHUNK);
            }

            let rms = rms_dbfs(&pcm_f32);

            let settings = app.state::<SettingsState>().get();
            let gate = app.state::<MicGateState>();
            let should_send = match settings.vad_mode.as_str() {
                "aggressive" => rms > -42.0,
                "manual" => gate.0.load(std::sync::atomic::Ordering::SeqCst),
                _ => rms > -50.0,
            };

            if should_send {
                let mut pcm_bytes = Vec::with_capacity(BYTES_PER_CHUNK);
                f32_to_s16le_bytes(&pcm_f32, &mut pcm_bytes);
                let _ = ai_send_audio_impl(ai_handle.clone(), pcm_bytes).await;
            }
            let _ = app.emit("mic:level", MicLevel { rms_db: rms });
        }
    }

    log::info!("mic: drain task exiting");
}