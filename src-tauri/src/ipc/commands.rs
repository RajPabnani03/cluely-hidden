//! Tauri command handlers. Each function is invoked from the React frontend
//! via `invoke('name', args)`. Keep them thin — delegate to the appropriate
//! module.

use std::sync::Arc;

use tauri::{AppHandle, Emitter};

use crate::db::DbState;
use crate::error::Result;
use crate::settings::{AppSettingsPublic, SettingsPatch, SettingsState};
use crate::hotkeys::actions;
use crate::hotkeys::registry::HotkeyState;
use crate::window::helpers;
// ---------- Window ----------

#[tauri::command]
pub fn toggle_overlay(app: AppHandle) -> Result<()> {
    helpers::toggle(&app)
}

#[tauri::command]
pub fn show_overlay(app: AppHandle) -> Result<()> {
    helpers::show(&app)
}

#[tauri::command]
pub fn hide_overlay(app: AppHandle) -> Result<()> {
    helpers::hide(&app)
}

#[tauri::command]
pub fn set_click_through(app: AppHandle, enabled: bool) -> Result<()> {
    helpers::set_click_through(&app, enabled)
}

#[tauri::command]
pub fn open_settings(app: AppHandle) -> Result<()> {
    helpers::open_settings(&app)
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    helpers::quit(&app);
}

// ---------- Settings ----------

#[tauri::command]
pub fn get_settings(state: tauri::State<'_, SettingsState>) -> Result<AppSettingsPublic> {
    Ok(state.get_public())
}

#[tauri::command]
pub fn update_settings(
    state: tauri::State<'_, SettingsState>,
    patch: SettingsPatch,
) -> Result<AppSettingsPublic> {
    state.update(patch)
}

// ---------- Hotkeys ----------

/// Return all current hotkey bindings as `(action_id, key)` pairs.
#[tauri::command]
pub fn get_hotkey_bindings(state: tauri::State<'_, HotkeyState>) -> Result<Vec<(String, String)>> {
    let registry = state.0.lock().expect("hotkey mutex poisoned");
    Ok(registry.current_bindings())
}

/// Rebind a single action to a new key combo.
#[tauri::command]
pub fn rebind_hotkey(
    state: tauri::State<'_, HotkeyState>,
    settings: tauri::State<'_, SettingsState>,
    app: tauri::AppHandle,
    action: String,
    new_key: String,
) -> Result<()> {
    let action_enum = actions::from_action_id(&action)
        .ok_or_else(|| crate::error::AppError::Other(format!("unknown action: {action}")))?;
    let mut registry = state.0.lock().expect("hotkey mutex poisoned");
    registry.rebind(&app, action_enum, new_key.clone())?;
    settings.set_hotkey_override(&action, &new_key)?;
    Ok(())
}

#[tauri::command]
pub fn cycle_stealth_tier(
    app: AppHandle,
    settings: tauri::State<'_, SettingsState>,
) -> Result<()> {
    crate::window::stealth::cycle_stealth_tier(&app, &settings)
}

#[tauri::command]
pub fn set_overlay_layout(
    app: AppHandle,
    settings: tauri::State<'_, SettingsState>,
    layout: String,
) -> Result<()> {
    let layout = if layout == "compact" { "compact" } else { "full" };
    let patch = SettingsPatch {
        overlay_layout: Some(layout.to_string()),
        ..Default::default()
    };
    settings.update(patch)?;
    crate::window::layout::apply_layout(&app, layout)
}

// ---------- Chat (text fallback: Groq or stub) ----------

#[tauri::command]
pub async fn chat(
    input: ChatInput,
    settings: tauri::State<'_, SettingsState>,
) -> Result<ChatOutput> {
    log::info!(
        "chat invoked: conv={:?}, msg_len={}",
        input.conversation_id,
        input.message.len()
    );

    let s = settings.get();
    let content = if s.ai_provider == "groq" {
        if std::env::var("GROQ_API_KEY").is_ok() {
            crate::ai::groq::complete_text(&s.model, &input.message).await?
        } else {
            crate::ai::groq::stub_reply(&input.message)
        }
    } else {
        format!(
            "(Gemini Live is the primary path.) Text chat stub: \"{}\"",
            input.message
        )
    };

    Ok(ChatOutput {
        id: input.conversation_id.unwrap_or_else(|| "pending".to_string()),
        role: "assistant".to_string(),
        content,
        created_at: chrono::Utc::now().timestamp_millis(),
    })
}

#[derive(Debug, serde::Deserialize)]
pub struct ChatInput {
    pub conversation_id: Option<String>,
    pub message: String,
}

#[derive(Debug, serde::Serialize)]
pub struct ChatOutput {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: i64,
}

// ---------- Phase 3A — Database (profiles / conversations / messages / captures) ----------
//
// Each command takes `state: tauri::State<'_, DbState>`, locks the
// connection, and delegates to a pure function in `crate::db::*`. This
// keeps the IPC layer thin and the db functions testable in isolation.

/// Lock the shared DB connection. Centralized so every command panics
/// with the same message if the mutex is poisoned.
fn conn<'a>(state: &'a tauri::State<'_, DbState>) -> std::sync::MutexGuard<'a, rusqlite::Connection> {
    state.0.lock().expect("db mutex poisoned")
}

// ---- Profiles ----

#[tauri::command]
pub fn list_profiles(state: tauri::State<'_, DbState>) -> Result<Vec<crate::db::profiles::Profile>> {
    crate::db::profiles::list(&conn(&state))
}

#[tauri::command]
pub fn get_profile(
    state: tauri::State<'_, DbState>,
    id: String,
) -> Result<Option<crate::db::profiles::Profile>> {
    crate::db::profiles::get(&conn(&state), &id)
}

#[tauri::command]
pub fn create_profile(
    state: tauri::State<'_, DbState>,
    name: String,
    system_prompt: String,
) -> Result<crate::db::profiles::Profile> {
    crate::db::profiles::create(&conn(&state), name, system_prompt)
}

#[tauri::command]
pub fn update_profile(
    state: tauri::State<'_, DbState>,
    id: String,
    name: Option<String>,
    system_prompt: Option<String>,
    max_words: Option<i32>,
    tone: Option<String>,
) -> Result<crate::db::profiles::Profile> {
    crate::db::profiles::update(&conn(&state), &id, name, system_prompt, max_words, tone)
}

#[tauri::command]
pub fn delete_profile(state: tauri::State<'_, DbState>, id: String) -> Result<()> {
    crate::db::profiles::delete(&conn(&state), &id)
}

// ---- Conversations ----

#[tauri::command]
pub fn list_conversations(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<crate::db::conversations::Conversation>> {
    crate::db::conversations::list(&conn(&state))
}

#[tauri::command]
pub fn create_conversation(
    state: tauri::State<'_, DbState>,
    profile_id: Option<String>,
) -> Result<crate::db::conversations::Conversation> {
    crate::db::conversations::create(&conn(&state), profile_id)
}

#[tauri::command]
pub fn update_conversation_title(
    state: tauri::State<'_, DbState>,
    id: String,
    title: String,
) -> Result<()> {
    crate::db::conversations::update_title(&conn(&state), &id, title)
}

#[tauri::command]
pub fn delete_conversation(state: tauri::State<'_, DbState>, id: String) -> Result<()> {
    crate::db::conversations::delete(&conn(&state), &id)
}

// ---- Messages ----

#[tauri::command]
pub fn list_messages(
    state: tauri::State<'_, DbState>,
    conversation_id: String,
) -> Result<Vec<crate::db::messages::Message>> {
    crate::db::messages::list_for_conversation(&conn(&state), &conversation_id)
}

#[tauri::command]
pub fn save_message(
    state: tauri::State<'_, DbState>,
    conversation_id: String,
    role: String,
    content: String,
    audio_transcript: Option<String>,
    screenshot_id: Option<String>,
    model: Option<String>,
) -> Result<crate::db::messages::Message> {
    let message = crate::db::messages::create(
        &conn(&state),
        conversation_id,
        role,
        content,
        audio_transcript,
        screenshot_id,
        model,
    )?;
    // Bump the parent conversation's `updated_at` so it floats to the top
    // of the sidebar. Failure here is non-fatal — the message is saved.
    let _ = crate::db::conversations::touch(&conn(&state), &message.conversation_id);
    Ok(message)
}

// ---- Captures ----

#[tauri::command]
pub fn create_capture(
    state: tauri::State<'_, DbState>,
    kind: String,
    file_path: String,
    width: Option<i32>,
    height: Option<i32>,
    duration_ms: Option<i64>,
) -> Result<crate::db::captures::Capture> {
    crate::db::captures::create(&conn(&state), kind, file_path, width, height, duration_ms)
}

#[tauri::command]
pub fn get_capture(
    state: tauri::State<'_, DbState>,
    id: String,
) -> Result<Option<crate::db::captures::Capture>> {
    crate::db::captures::get(&conn(&state), &id)
}

// ---------- Phase 5 — AI Live WebSocket session ----------
//
// Thin IPC wrappers around `crate::ai::GeminiLiveClient`. The
// connection is held in shared `AiState` (a `Mutex<Option<...>>`)
// so that the React frontend can `start` once, push audio chunks
// continuously, and `stop` on shutdown.

use base64::Engine as _;
use crate::ai::GeminiLiveClient;

/// Shared handle for the live Gemini session. `None` when idle.
pub struct AiState(pub std::sync::Mutex<Option<GeminiLiveClient>>);

impl Default for AiState {
    fn default() -> Self {
        AiState(std::sync::Mutex::new(None))
    }
}

/// Open a new Gemini Live session and stash the handle in
/// `AiState`. Errors are surfaced to the frontend as strings.
#[tauri::command]
pub async fn ai_start_live(
    app: AppHandle,
    state: tauri::State<'_, AiState>,
    api_key: String,
    system_instruction: String,
) -> std::result::Result<(), String> {
    ai_start_live_impl(&app, &state, api_key.trim(), system_instruction).await
}

/// Start Gemini Live using the stored API key and active profile (or first profile).
#[tauri::command]
pub async fn ai_start_live_configured(
    app: AppHandle,
    ai_state: tauri::State<'_, AiState>,
    settings_state: tauri::State<'_, SettingsState>,
    db_state: tauri::State<'_, DbState>,
    profile_id: Option<String>,
) -> std::result::Result<(), String> {
    let settings = settings_state.get();
    let key = settings.gemini_api_key.trim();
    if key.is_empty() {
        return Err(
            "Add your Gemini API key in Settings → Model → Gemini API key.".to_string(),
        );
    }

    let system_prompt = {
        let guard = conn(&db_state);
        resolve_profile(&guard, profile_id.or(settings.active_profile_id))?.system_prompt
    };

    ai_start_live_impl(&app, &ai_state, key, system_prompt).await
}

async fn ai_start_live_impl(
    app: &AppHandle,
    state: &tauri::State<'_, AiState>,
    api_key: &str,
    system_instruction: String,
) -> std::result::Result<(), String> {
    if api_key.is_empty() {
        return Err("Gemini API key is empty.".to_string());
    }

    let client = GeminiLiveClient::connect(app, api_key, &system_instruction)
        .await
        .map_err(|e| e.to_string())?;

    let mut guard = state.0.lock().expect("ai mutex poisoned");
    *guard = Some(client);
    Ok(())
}

fn resolve_profile(
    conn: &rusqlite::Connection,
    profile_id: Option<String>,
) -> std::result::Result<crate::db::profiles::Profile, String> {
    if let Some(id) = profile_id {
        return crate::db::profiles::get(conn, &id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("profile not found: {id}"));
    }
    let list = crate::db::profiles::list(conn).map_err(|e| e.to_string())?;
    list.into_iter()
        .next()
        .ok_or_else(|| "no profiles in database".to_string())
}

/// Forward a base64-encoded 24 kHz / mono PCM chunk to Gemini Live.
#[tauri::command]
pub async fn ai_send_audio(
    state: tauri::State<'_, AiState>,
    pcm_base64: String,
) -> std::result::Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(pcm_base64.as_bytes())
        .map_err(|e| format!("invalid base64 payload: {e}"))?;

    // Pull an Arc<AiState> clone out of the Tauri State so we can
    // pass it across an `.await` (the Tauri `State` itself isn't
    // Send/Sync-friendly across awaits — it borrows the runtime
    // internal lock).
    let ai_handle = Arc::new(AiState(std::sync::Mutex::new(
        state.0.lock().expect("ai mutex poisoned").clone(),
    )));
    ai_send_audio_impl(ai_handle, bytes).await
}

/// Inner implementation of `ai_send_audio` that takes raw PCM bytes
/// plus an `Arc<AiState>` clone. Used by both the IPC command
/// (above) and the microphone drain task in `crate::audio::mic`.
///
/// We hold the *full* client in `Arc<AiState>` (rather than just an
/// `Option<GeminiLiveClient>`) because `GeminiLiveClient` is `Clone`
/// (Arc-backed internally) and we need to call its async
/// `send_audio_chunk` from the drain task — which can't borrow a
/// `tauri::State<'_, _>` across the `.await`.
pub async fn ai_send_audio_impl(
    ai_state: Arc<AiState>,
    bytes: Vec<u8>,
) -> std::result::Result<(), String> {
    // Clone the client out of the mutex before awaiting.
    let client = {
        let guard = ai_state.0.lock().expect("ai mutex poisoned");
        match guard.as_ref() {
            Some(c) => c.clone(),
            None => {
                // No active AI session — silently drop the chunk.
                // This is normal when capture is started before
                // `ai_start_live` or after `ai_stop_live`.
                return Ok(());
            }
        }
    };

    client
        .send_audio_chunk(&bytes)
        .await
        .map_err(|e| e.to_string())
}

/// Close the active Gemini Live session (if any).
#[tauri::command]
pub async fn ai_stop_live(state: tauri::State<'_, AiState>) -> std::result::Result<(), String> {
    // Take the client out of the mutex first to avoid holding a
    // non-Send MutexGuard across an `.await`.
    let client = {
        let mut guard = state.0.lock().expect("ai mutex poisoned");
        guard.take()
    };
    if let Some(client) = client {
        client.close().await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---- Capture pipeline (Phase 3B) ----

/// Capture the primary display, persist the PNG to disk, record the
/// artifact in the `captures` table, and emit `"capture:screen"` so the
/// frontend can react.
///
/// Returns the [`CaptureMeta`] describing the new capture (id, path,
/// width, height, created_at). Errors are serialized as a string to
/// match the convention used by every other command in this file.
#[tauri::command]
pub async fn capture_screen(
    app: AppHandle,
    state: tauri::State<'_, DbState>,
) -> std::result::Result<crate::capture::CaptureMeta, String> {
    // 1. Take the screenshot (blocking — xcap is sync).
    let meta = crate::capture::capture_primary_display()
        .map_err(|e| e.to_string())?;

    // 2. Insert a row into the `captures` table referencing the file.
    //    We use `capture_screen` as the trigger, but the schema requires
    //    `kind` to be 'screen' or 'audio' — keep it consistent.
    let _row = crate::db::captures::create(
        &conn(&state),
        "screen".to_string(),
        meta.path.to_string_lossy().into_owned(),
        Some(meta.width as i32),
        Some(meta.height as i32),
        None,
    )
    .map_err(|e| e.to_string())?;

    // 3. Emit the event so the frontend can update the history view in
    //    real time without polling.
    if let Err(e) = app.emit("capture:screen", &meta) {
        log::warn!("failed to emit capture:screen event: {e:#}");
    }

    log::info!("capture_screen complete: id={} path={}", meta.id, meta.path.display());
    Ok(meta)
}

// ---- Phase 6 — Microphone capture pipeline ----
//
// `mic_start` opens the default input device, builds a cpal stream,
// resamples to 24 kHz / mono s16le, and forwards 100 ms chunks into
// the active Gemini Live session (if any). `mic_stop` drops the
// capture handle, which tears down the cpal stream and the drain
// task.
//
// The handle lives in `MicState(Mutex<Option<MicCapture>>)` so the
// frontend can start/stop capture multiple times per app lifetime.

use crate::audio::mic::{start_capture, MicCapture};

/// Shared handle for an active microphone capture session.
/// `None` when capture is idle.
pub struct MicState(pub std::sync::Mutex<Option<MicCapture>>);

impl Default for MicState {
    fn default() -> Self {
        MicState(std::sync::Mutex::new(None))
    }
}

/// Open the default input device and start streaming into the active
/// Gemini Live session (no-op if the session isn't open yet).
///
/// Safe to call when capture is already active — the new handle
/// replaces the old one (the old cpal stream is dropped and stops).
#[tauri::command]
pub async fn mic_start(
    app: AppHandle,
    state: tauri::State<'_, MicState>,
) -> std::result::Result<(), String> {
    let capture = start_capture(app.clone())
        .await
        .map_err(|e| e.to_string())?;

    // Replace any existing handle. Dropping the previous one stops
    // the previous cpal stream.
    let mut guard = state.0.lock().expect("mic mutex poisoned");
    *guard = Some(capture);

    log::info!("mic_start: capture handle installed");
    Ok(())
}

/// Stop the active capture (if any). Dropping the handle tears down
/// the cpal stream and the drain task.
#[tauri::command]
pub async fn mic_stop(
    state: tauri::State<'_, MicState>,
) -> std::result::Result<(), String> {
    let mut guard = state.0.lock().expect("mic mutex poisoned");
    *guard = None; // drop MicCapture → stream stops
    log::info!("mic_stop: capture handle dropped");
    Ok(())
}

/// Push-to-talk gate for `vad_mode = manual`.
pub struct MicGateState(pub std::sync::atomic::AtomicBool);

impl Default for MicGateState {
    fn default() -> Self {
        MicGateState(std::sync::atomic::AtomicBool::new(false))
    }
}

#[tauri::command]
pub fn set_mic_gate(open: bool, gate: tauri::State<'_, MicGateState>) -> std::result::Result<(), String> {
    gate.0.store(open, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

// ---- Sprint C — dual brain ----

#[tauri::command]
pub async fn dual_brain_step(
    app: AppHandle,
    settings_state: tauri::State<'_, SettingsState>,
    db_state: tauri::State<'_, DbState>,
    live_transcript: String,
    extra_context: String,
    profile_id: Option<String>,
) -> std::result::Result<crate::ai::dual_brain::DualBrainResult, String> {
    let settings = settings_state.get();
    let profile = {
        let guard = conn(&db_state);
        resolve_profile(&guard, profile_id.or(settings.active_profile_id.clone()))?
    };
    crate::ai::dual_brain::dual_brain_step(
        &app,
        &settings,
        &profile,
        &live_transcript,
        &extra_context,
    )
    .await
    .map_err(|e| e.to_string())
}

// ---- Sprint D — export / wipe ----

#[tauri::command]
pub fn export_conversation_markdown(
    state: tauri::State<'_, DbState>,
    conversation_id: String,
) -> Result<String> {
    crate::db::export::export_markdown(&conn(&state), &conversation_id)
}

#[tauri::command]
pub fn wipe_local_data(state: tauri::State<'_, DbState>) -> Result<()> {
    crate::db::wipe::wipe_local_data(&conn(&state))
}

// ---- Sprint E — vault / calendar ----

#[tauri::command]
pub fn vault_index_folder(
    state: tauri::State<'_, DbState>,
    folder_path: String,
) -> Result<usize> {
    let path = expand_user_path(&folder_path);
    crate::db::vault::index_folder(&conn(&state), &path)
}

fn expand_user_path(p: &str) -> std::path::PathBuf {
    if let Some(rest) = p.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest);
        }
    }
    std::path::PathBuf::from(p)
}

#[tauri::command]
pub fn vault_query(
    state: tauri::State<'_, DbState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<crate::db::vault::VaultHit>> {
    crate::db::vault::query(&conn(&state), &query, limit.unwrap_or(8))
}

#[tauri::command]
pub fn calendar_hints(limit: Option<usize>) -> Result<Vec<crate::calendar::CalendarHint>> {
    crate::calendar::upcoming_hints(limit.unwrap_or(5))
}
