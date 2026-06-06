//! User-facing settings, persisted via `tauri-plugin-store`.

use serde::{Deserialize, Serialize};

use crate::config::DEFAULT_HOTKEY;
use crate::error::Result;

/// App settings — synced to the frontend and persisted in
/// `~/Library/Application Support/com.cluelyhidden.app/settings.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub hotkey: String,
    pub theme: String, // "light" | "dark" | "system"
    pub model: String,
    pub capture_enabled: bool,
    pub audio_enabled: bool,
    pub launch_at_login: bool,
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
        }
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

    pub fn update(&self, patch: AppSettings) -> Result<AppSettings> {
        let mut guard = self.inner.lock().expect("settings mutex poisoned");
        *guard = patch;
        let snapshot = guard.clone();
        drop(guard);
        // In Phase 3 we'll persist via tauri-plugin-store here.
        // For v0.1, in-memory only.
        Ok(snapshot)
    }
}
