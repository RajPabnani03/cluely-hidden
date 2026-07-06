//! User-facing settings, persisted via `tauri-plugin-store` (planned) / in-memory for now.

use serde::{Deserialize, Serialize};

use crate::config::DEFAULT_HOTKEY;
use crate::error::Result;

/// App settings — synced to the frontend and persisted in
/// `~/Library/Application Support/com.cluelyhidden.app/settings.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub hotkey: String,
    pub theme: String, // "light" | "dark" | "system"
    pub model: String,
    pub capture_enabled: bool,
    pub audio_enabled: bool,
    pub launch_at_login: bool,
    /// Google AI Studio / Gemini API key for Live sessions.
    #[serde(default)]
    pub gemini_api_key: String,
    /// Profile id used for `system_prompt` when starting Gemini Live.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_profile_id: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            hotkey: DEFAULT_HOTKEY.to_string(),
            theme: "dark".to_string(),
            model: "llama3.2:3b".to_string(),
            capture_enabled: true,
            audio_enabled: false,
            launch_at_login: false,
            gemini_api_key: String::new(),
            active_profile_id: None,
        }
    }
}

/// Partial-update payload from the frontend. All fields optional so the
/// UI can send just the changed ones.
#[derive(Debug, Default, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub hotkey: Option<String>,
    pub theme: Option<String>,
    pub model: Option<String>,
    pub capture_enabled: Option<bool>,
    pub audio_enabled: Option<bool>,
    pub launch_at_login: Option<bool>,
    pub gemini_api_key: Option<String>,
    pub active_profile_id: Option<Option<String>>,
}

impl SettingsPatch {
    pub fn apply_to(self, mut s: AppSettings) -> AppSettings {
        if let Some(v) = self.hotkey {
            s.hotkey = v;
        }
        if let Some(v) = self.theme {
            s.theme = v;
        }
        if let Some(v) = self.model {
            s.model = v;
        }
        if let Some(v) = self.capture_enabled {
            s.capture_enabled = v;
        }
        if let Some(v) = self.audio_enabled {
            s.audio_enabled = v;
        }
        if let Some(v) = self.launch_at_login {
            s.launch_at_login = v;
        }
        if let Some(v) = self.gemini_api_key {
            s.gemini_api_key = v;
        }
        if let Some(v) = self.active_profile_id {
            s.active_profile_id = v;
        }
        s
    }
}

/// Tauri-managed state holding the live settings. Updated on every
/// `update_settings` call and written to disk via the store plugin.
#[derive(Default)]
pub struct SettingsState {
    inner: std::sync::Mutex<AppSettings>,
}

impl SettingsState {
    pub fn get(&self) -> AppSettings {
        self.inner.lock().expect("settings mutex poisoned").clone()
    }

    pub fn update(&self, patch: SettingsPatch) -> Result<AppSettings> {
        let mut guard = self.inner.lock().expect("settings mutex poisoned");
        let merged = patch.apply_to(guard.clone());
        *guard = merged.clone();
        drop(guard);
        Ok(merged)
    }
}