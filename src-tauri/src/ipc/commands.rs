//! Tauri command handlers. Each function is invoked from the React frontend
//! via `invoke('name', args)`. Keep them thin — delegate to the appropriate
//! module.

use tauri::{AppHandle, Emitter};

use crate::db::DbState;
use crate::error::Result;
use crate::settings::{AppSettings, SettingsPatch, SettingsState};
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
pub fn get_settings(state: tauri::State<'_, SettingsState>) -> Result<AppSettings> {
    Ok(state.get())
}

#[tauri::command]
pub fn update_settings(
    state: tauri::State<'_, SettingsState>,
    patch: SettingsPatch,
) -> Result<AppSettings> {
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
    app: tauri::AppHandle,
    action: String,
    new_key: String,
) -> Result<()> {
    let action_enum = actions::from_action_id(&action)
        .ok_or_else(|| crate::error::AppError::Other(format!("unknown action: {action}")))?;
    let mut registry = state.0.lock().expect("hotkey mutex poisoned");
    registry.rebind(&app, action_enum, new_key)
}

// ---------- Chat (stub for v0.1; real streaming in v0.2) ----------

#[tauri::command]
pub fn chat(input: ChatInput) -> Result<ChatOutput> {
    // For v0.1, echo the user message back. Real AI is wired in Phase 7.
    log::info!("chat invoked: conv={:?}, msg_len={}", input.conversation_id, input.message.len());

    let reply = format!(
        "(stub) You said: \"{}\"\n\nIn v0.2 this will route to Ollama (local) or your cloud provider.",
        input.message
    );

    Ok(ChatOutput {
        id: input.conversation_id.unwrap_or_else(|| "pending".to_string()),
        role: "assistant".to_string(),
        content: reply,
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
) -> Result<crate::db::profiles::Profile> {
    crate::db::profiles::update(&conn(&state), &id, name, system_prompt)
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
    let client = GeminiLiveClient::connect(&app, &api_key, &system_instruction)
        .await
        .map_err(|e| e.to_string())?;

    // Lock the (sync) mutex — these are quick operations and won't
    // block for long, even though `start` itself is async.
    let mut guard = state.0.lock().expect("ai mutex poisoned");
    *guard = Some(client);
    Ok(())
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

    // Clone the client (it's Arc-backed internally so this is cheap)
    // out of the mutex before awaiting. The client itself is Clone
    // because all its fields are.
    let client = {
        let guard = state.0.lock().expect("ai mutex poisoned");
        guard
            .as_ref()
            .ok_or_else(|| "ai session not started".to_string())?
            .clone()
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
