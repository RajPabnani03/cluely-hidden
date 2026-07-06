//! Gemini Live (Multimodal Live API) — bidi WebSocket client.
//!
//! Endpoint:
//!   `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}`
//!
//! Lifecycle:
//!   1. [`GeminiLiveClient::connect`] dials the endpoint, sends a
//!      `setup` message describing the model / modalities / system
//!      instruction, then spawns a background reader task that parses
//!      every server message and re-emits the relevant bits as Tauri
//!      events.
//!   2. [`GeminiLiveClient::send_audio_chunk`] base64-encodes a
//!      24 kHz / mono PCM chunk and wraps it as a `realtime_input`
//!      `media_chunks` envelope.
//!   3. [`GeminiLiveClient::close`] asks the background reader task
//!      to perform a graceful close.
//!
//! If the connection drops, the reader task auto-reconnects up to
//! 3 times with a 2 s back-off and emits `ai:status` =
//! `"reconnecting"` for each attempt.

use std::sync::Arc;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message};

const WS_URL: &str = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const MODEL: &str = "models/gemini-live-2.5-flash-preview";
const MAX_RECONNECT_ATTEMPTS: u32 = 3;
const RECONNECT_DELAY_MS: u64 = 2000;

/// Owned runtime handle to a single Gemini Live session.
#[derive(Clone)]
pub struct GeminiLiveClient {
    app: AppHandle,
    inner: Arc<Mutex<Inner>>,
    /// Signal channel used to ask the reader task to shut down.
    shutdown_tx: mpsc::UnboundedSender<()>,
}

struct Inner {
    /// Outbound half — senders into the WebSocket writer task.
    tx: mpsc::UnboundedSender<String>,
}

impl Drop for Inner {
    fn drop(&mut self) {
        // Dropping the inner sender closes the writer task's loop.
    }
}

/// Top-level error type for the Gemini Live client.
#[derive(Debug, thiserror::Error)]
pub enum GeminiLiveError {
    #[error("websocket error: {0}")]
    WebSocket(#[from] tokio_tungstenite::tungstenite::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("not connected")]
    NotConnected,

    #[error("{0}")]
    Other(String),
}

/// `String` results are what Tauri commands return to the frontend.
impl From<GeminiLiveError> for String {
    fn from(e: GeminiLiveError) -> Self {
        e.to_string()
    }
}

impl GeminiLiveClient {
    /// Open a new bidi session.
    pub async fn connect(
        app: &AppHandle,
        api_key: &str,
        system_instruction: &str,
    ) -> Result<Self, GeminiLiveError> {
        let url = format!("{WS_URL}?key={api_key}");

        // Open the connection and send the setup envelope on this
        // stack frame so we can hand the split halves off cleanly to
        // the writer / reader tasks.
        let ws_stream = dial(&url).await?;
        let (mut ws_sink, ws_read) = ws_stream.split();
        send_setup(&mut ws_sink, system_instruction).await?;

        // Bounded-channel is more idiomatic, but we want non-blocking
        // sends from `send_audio_chunk`; unbounded is fine because the
        // writer task drains immediately.
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();
        let (shutdown_tx, mut shutdown_rx) = mpsc::unbounded_channel::<()>();

        // Writer task — pumps outgoing messages to the socket.
        tokio::spawn(async move {
            // If we receive a control message via `rx`, forward it;
            // on shutdown signal or empty channel, close the socket
            // and exit.
            tokio::select! {
                _ = shutdown_rx.recv() => {
                    let _ = ws_sink.send(Message::Close(None)).await;
                }
                _ = async {
                    while let Some(payload) = rx.recv().await {
                        if ws_sink.send(Message::Text(payload)).await.is_err() {
                            break;
                        }
                    }
                } => {}
            }
        });

        // Reader task — owns the read half and reconnects on failure.
        // We pass the connection params (URL, system instruction,
        // api_key) so it can rebuild a socket on each attempt.
        let app_reader = app.clone();
        let api_key_owned = api_key.to_string();
        let sys_owned = system_instruction.to_string();
        tokio::spawn(async move {
            run_reader_with_reconnect(app_reader, &api_key_owned, &sys_owned, ws_read).await;
        });

        Ok(Self {
            app: app.clone(),
            inner: Arc::new(Mutex::new(Inner { tx })),
            shutdown_tx,
        })
    }

    /// Send a 24 kHz / mono PCM audio chunk to the model.
    pub async fn send_audio_chunk(&self, pcm_24khz_mono: &[u8]) -> Result<(), GeminiLiveError> {
        let encoded = BASE64.encode(pcm_24khz_mono);
        let envelope = json!({
            "realtime_input": {
                "media_chunks": [{
                    "mime_type": "audio/pcm;rate=24000",
                    "data": encoded,
                }]
            }
        });
        let payload = serde_json::to_string(&envelope)?;

        let inner = self.inner.lock().await;
        inner
            .tx
            .send(payload)
            .map_err(|_| GeminiLiveError::NotConnected)?;
        Ok(())
    }

    /// Gracefully close the underlying WebSocket.
    pub async fn close(&self) -> Result<(), GeminiLiveError> {
        // Tell the writer task to issue a `Close` frame and exit.
        let _ = self.shutdown_tx.send(());
        log::info!("gemini-live: close requested");
        let _ = self.app.emit("ai:status", "closed");
        Ok(())
    }
}

/// Open a TLS WebSocket connection to the Gemini Live endpoint.
async fn dial(
    url: &str,
) -> Result<
    tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    GeminiLiveError,
> {
    let mut request = url.into_client_request()?;
    request.headers_mut().insert(
        "Origin",
        "https://generativelanguage.googleapis.com"
            .parse()
            .expect("valid header value"),
    );
    let (ws_stream, _resp) = tokio_tungstenite::connect_async(request).await?;
    Ok(ws_stream)
}

/// Send the initial `setup` envelope to Gemini Live.
async fn send_setup<W>(
    sink: &mut W,
    system_instruction: &str,
) -> Result<(), GeminiLiveError>
where
    W: SinkExt<Message> + Unpin,
    <W as futures_util::Sink<Message>>::Error: std::fmt::Debug,
{
    let setup_msg = json!({
        "setup": {
            "model": MODEL,
            "generation_config": {
                "response_modalities": ["AUDIO"],
                "input_audio_transcription": {},
                "output_audio_transcription": {},
            },
            "system_instruction": {
                "parts": [{ "text": system_instruction }],
            }
        }
    });
    let payload = serde_json::to_string(&setup_msg)?;
    sink.send(Message::Text(payload)).await.map_err(|e| {
        GeminiLiveError::Other(format!("failed to send setup: {:?}", e))
    })?;
    Ok(())
}

/// Run the bidi reader loop with auto-reconnect.
///
/// On a disconnect we re-dial the endpoint, re-send the same `setup`
/// envelope, and emit `ai:status` = `"reconnecting"` between
/// attempts.
async fn run_reader_with_reconnect(
    app: AppHandle,
    api_key: &str,
    system_instruction: &str,
    ws_read: futures_util::stream::SplitStream<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    >,
) {
    // Drain the initial connection. After it ends (clean or not)
    // we reconnect up to MAX_RECONNECT_ATTEMPTS times.
    let _ = drain(&app, ws_read).await;

    let url = format!("{WS_URL}?key={api_key}");
    for attempt in 0..MAX_RECONNECT_ATTEMPTS {
        log::warn!(
            "gemini-live: connection lost; reconnect attempt {}/{} in {RECONNECT_DELAY_MS}ms",
            attempt + 1,
            MAX_RECONNECT_ATTEMPTS
        );
        let _ = app.emit(
            "ai:status",
            format!("reconnecting (attempt {})", attempt + 1),
        );
        tokio::time::sleep(std::time::Duration::from_millis(RECONNECT_DELAY_MS)).await;

        match open_and_drain(&app, &url, system_instruction).await {
            Ok(()) => return,
            Err(e) => {
                log::warn!("gemini-live: reconnect attempt {attempt} failed: {e}");
            }
        }
    }
    log::error!("gemini-live: gave up after {MAX_RECONNECT_ATTEMPTS} attempts");
    let _ = app.emit(
        "ai:status",
        "reconnect failed — give up".to_string(),
    );
}

/// Drain an already-open read stream until the socket closes.
async fn drain(
    app: &AppHandle,
    mut ws_read: futures_util::stream::SplitStream<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    >,
) -> Result<(), GeminiLiveError> {
    while let Some(msg) = ws_read.next().await {
        let msg = msg?;
        match msg {
            Message::Text(text) => {
                if let Err(e) = dispatch(app, &text).await {
                    log::warn!("gemini-live: dispatch error: {e}");
                }
            }
            Message::Close(frame) => {
                log::info!("gemini-live: server closed: {:?}", frame);
                return Ok(());
            }
            Message::Ping(_) | Message::Pong(_) | Message::Binary(_) | Message::Frame(_) => {}
        }
    }
    Ok(())
}

/// (Re-)open a socket and drain it.
async fn open_and_drain(
    app: &AppHandle,
    url: &str,
    system_instruction: &str,
) -> Result<(), GeminiLiveError> {
    let ws_stream = dial(url).await?;
    let (mut ws_sink, ws_read) = ws_stream.split();
    send_setup(&mut ws_sink, system_instruction).await?;
    drain(app, ws_read).await
}

/// Parse one server message and fire the corresponding Tauri event.
async fn dispatch(app: &AppHandle, raw: &str) -> Result<(), GeminiLiveError> {
    let v: Value = serde_json::from_str(raw)?;

    // `setupComplete` — arrive once per session right after the
    // server accepts our `setup` envelope.
    if v.get("setupComplete").is_some() {
        log::info!("gemini-live: setupComplete");
        let _ = app.emit::<String>("ai:status", "ready".into());
        return Ok(());
    }

    // Conversation content lives under `serverContent`.
    if let Some(server_content) = v.get("serverContent") {
        // `inputTranscription.text` — user's spoken words.
        if let Some(text) = server_content
            .get("inputTranscription")
            .and_then(|t| t.get("text"))
            .and_then(|t| t.as_str())
        {
            let _ = app.emit("ai:transcript", text.to_string());
        }

        // `modelTurn.parts[]` — model output.
        if let Some(parts) = server_content
            .get("modelTurn")
            .and_then(|mt| mt.get("parts"))
            .and_then(|p| p.as_array())
        {
            for part in parts {
                if let Some(text) = part.get("text").and_then(|t| t.as_str()) {
                    let _ = app.emit("ai:response:text", text.to_string());
                }
                if let Some(audio) = part
                    .get("inlineData")
                    .and_then(|d| d.get("data"))
                    .and_then(|d| d.as_str())
                {
                    let payload = AudioChunk {
                        data: audio.to_string(),
                    };
                    let _ = app.emit("ai:response:audio", payload);
                }
            }
        }

        if server_content.get("turnComplete").is_some() {
            let _ = app.emit("ai:turn:complete", ());
        }
        if server_content.get("interrupted").is_some() {
            let _ = app.emit("ai:turn:interrupted", ());
        }
    }

    // `goAway` — server signaling the socket will close shortly.
    if let Some(go_away) = v.get("goAway") {
        log::warn!("gemini-live: goAway: {go_away}");
        let _ = app.emit("ai:status", "reconnecting (goAway)".to_string());
    }

    Ok(())
}

#[derive(Serialize, Clone)]
struct AudioChunk {
    data: String,
}
