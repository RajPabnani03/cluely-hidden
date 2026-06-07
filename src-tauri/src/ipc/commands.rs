//! Tauri command handlers. Each function is invoked from the React frontend
//! via `invoke('name', args)`. Keep them thin — delegate to the appropriate
//! module.

use tauri::AppHandle;

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
