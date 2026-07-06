//! Microphone audio-capture pipeline.
//!
//! Provides [`mic::MicCapture`] — a cpal-based input stream that pulls
//! samples from the default input device, downsamples them to 24 kHz
//! mono (the format Gemini Live expects), and forwards 100 ms PCM
//! chunks into a shared [`tokio::sync::mpsc::UnboundedSender<Vec<u8>>`]
//! for a drain task to consume.
//!
//! A separate tokio task drains the channel, emits `"mic:level"`
//! events with the RMS level in dBFS, and forwards each chunk into
//! the active Gemini Live session via the existing
//! [`crate::ipc::commands::ai_send_audio_impl`] helper.
//!
//! Audio-thread gotchas (see `mic.rs`):
//! - The cpal callback runs on a real-time audio thread; it MUST NOT
//!   `await` and MUST NOT hold a `std::sync::MutexGuard` across
//!   invocations. All inter-thread data is handed off through the
//!   `mpsc` channel.
//! - We never log directly to stdout from the audio thread (only via
//!   the `log` crate, which writes to stderr).

pub mod mic;

pub use mic::{start_capture, MicCapture};
