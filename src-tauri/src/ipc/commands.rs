//! Tauri command handlers. Each function is invoked from the React frontend
//! via `invoke('name', args)`. Keep them thin — delegate to the appropriate
//! module.

use tauri::AppHandle;

use crate::error::Result;
use crate::settings::{AppSettings, SettingsState};
use crate::window::{helpers, overlay};

// ---------- Window ----------

#[tauri::command]
pub fn toggle_overlay(app: AppHandle) -> Result<()> {
    overlay::toggle(&app)
}

#[tauri::command]
pub fn show_overlay(app: AppHandle) -> Result<()> {
    overlay::show(&app)
}

#[tauri::command]
pub fn hide_overlay(app: AppHandle) -> Result<()> {
    overlay::hide(&app)
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
    patch: AppSettings,
) -> Result<AppSettings> {
    state.update(patch)
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
