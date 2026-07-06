//! Persist non-secret settings to disk (`settings.json`).

use std::fs;
use std::io::Write;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::config;
use crate::error::{AppError, Result};
use crate::settings::AppSettings;

/// On-disk shape — **no API keys**.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredSettings {
    pub hotkey: String,
    pub theme: String,
    pub model: String,
    pub capture_enabled: bool,
    pub audio_enabled: bool,
    pub launch_at_login: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_profile_id: Option<String>,
    /// UI glass strength 0.4–1.0 (default 0.92).
    #[serde(default = "default_overlay_opacity")]
    pub overlay_opacity: f64,
}

fn default_overlay_opacity() -> f64 {
    0.92
}

impl From<&AppSettings> for StoredSettings {
    fn from(s: &AppSettings) -> Self {
        Self {
            hotkey: s.hotkey.clone(),
            theme: s.theme.clone(),
            model: s.model.clone(),
            capture_enabled: s.capture_enabled,
            audio_enabled: s.audio_enabled,
            launch_at_login: s.launch_at_login,
            active_profile_id: s.active_profile_id.clone(),
            overlay_opacity: s.overlay_opacity,
        }
    }
}

pub fn settings_path() -> std::path::PathBuf {
    config::data_dir().join("settings.json")
}

pub fn load_stored() -> Result<Option<StoredSettings>> {
    let path = settings_path();
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| AppError::Other(format!("read settings: {e}")))?;
    let mut stored: StoredSettings = serde_json::from_str(&raw)
        .map_err(|e| AppError::Other(format!("parse settings: {e}")))?;

    // Legacy: migrate inline geminiApiKey from old settings.json → Keychain once.
    if let Ok(legacy) = serde_json::from_str::<serde_json::Value>(&raw) {
        if let Some(key) = legacy.get("geminiApiKey").and_then(|v| v.as_str()) {
            if !key.trim().is_empty() {
                let _ = crate::secrets::set_gemini_api_key(key);
                log::info!("migrated Gemini API key from settings.json to Keychain");
                // Rewrite file without the legacy key field.
                save_stored(&stored)?;
            }
        }
    }

    // Clamp opacity
    if stored.overlay_opacity < 0.4 {
        stored.overlay_opacity = 0.4;
    } else if stored.overlay_opacity > 1.0 {
        stored.overlay_opacity = 1.0;
    }

    Ok(Some(stored))
}

pub fn save_stored(stored: &StoredSettings) -> Result<()> {
    let dir = config::data_dir();
    fs::create_dir_all(&dir).map_err(|e| AppError::Other(format!("mkdir data: {e}")))?;
    let path = settings_path();
    let json = serde_json::to_string_pretty(stored)
        .map_err(|e| AppError::Other(format!("serialize settings: {e}")))?;
    write_private_file(&path, json.as_bytes())?;
    Ok(())
}

fn write_private_file(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut file = fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path)
        .map_err(|e| AppError::Other(format!("open settings: {e}")))?;
    file.write_all(bytes)
        .map_err(|e| AppError::Other(format!("write settings: {e}")))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}