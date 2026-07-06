//! User-facing settings — Keychain for secrets, JSON for everything else.

mod persist;

use serde::{Deserialize, Serialize};

use crate::config::DEFAULT_HOTKEY;
use crate::error::Result;

pub use persist::{load_stored, save_stored, StoredSettings};

/// Full in-memory settings (includes Gemini key for Live IPC only).
#[derive(Debug, Clone)]
pub struct AppSettings {
    pub hotkey: String,
    pub theme: String,
    pub model: String,
    pub capture_enabled: bool,
    pub audio_enabled: bool,
    pub launch_at_login: bool,
    pub gemini_api_key: String,
    pub active_profile_id: Option<String>,
    pub overlay_opacity: f64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            hotkey: DEFAULT_HOTKEY.to_string(),
            theme: "dark".to_string(),
            model: "gemini-2.5-flash".to_string(),
            capture_enabled: true,
            audio_enabled: false,
            launch_at_login: false,
            gemini_api_key: String::new(),
            active_profile_id: None,
            overlay_opacity: 0.92,
        }
    }
}

/// IPC response — never includes the raw API key.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsPublic {
    pub hotkey: String,
    pub theme: String,
    pub model: String,
    pub capture_enabled: bool,
    pub audio_enabled: bool,
    pub launch_at_login: bool,
    pub gemini_api_key_configured: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_profile_id: Option<String>,
    pub overlay_opacity: f64,
}

impl AppSettings {
    pub fn to_public(&self) -> AppSettingsPublic {
        AppSettingsPublic {
            hotkey: self.hotkey.clone(),
            theme: self.theme.clone(),
            model: self.model.clone(),
            capture_enabled: self.capture_enabled,
            audio_enabled: self.audio_enabled,
            launch_at_login: self.launch_at_login,
            gemini_api_key_configured: !self.gemini_api_key.trim().is_empty(),
            active_profile_id: self.active_profile_id.clone(),
            overlay_opacity: self.overlay_opacity,
        }
    }

    pub fn load() -> Result<Self> {
        let mut s = Self::default();
        if let Some(stored) = load_stored()? {
            s.hotkey = stored.hotkey;
            s.theme = stored.theme;
            s.model = stored.model;
            s.capture_enabled = stored.capture_enabled;
            s.audio_enabled = stored.audio_enabled;
            s.launch_at_login = stored.launch_at_login;
            s.active_profile_id = stored.active_profile_id;
            s.overlay_opacity = stored.overlay_opacity;
        }
        if let Some(key) = crate::secrets::get_gemini_api_key()? {
            s.gemini_api_key = key;
        }
        Ok(s)
    }

    fn persist(&self) -> Result<()> {
        save_stored(&StoredSettings::from(self))
    }
}

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
    pub overlay_opacity: Option<f64>,
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
        if let Some(v) = self.active_profile_id {
            s.active_profile_id = v;
        }
        if let Some(v) = self.overlay_opacity {
            s.overlay_opacity = v.clamp(0.4, 1.0);
        }
        s
    }
}

pub struct SettingsState {
    inner: std::sync::Mutex<AppSettings>,
}

impl Default for SettingsState {
    fn default() -> Self {
        Self {
            inner: std::sync::Mutex::new(AppSettings::default()),
        }
    }
}

impl SettingsState {
    pub fn load() -> Result<Self> {
        Ok(Self {
            inner: std::sync::Mutex::new(AppSettings::load()?),
        })
    }

    pub fn get(&self) -> AppSettings {
        self.inner.lock().expect("settings mutex poisoned").clone()
    }

    pub fn get_public(&self) -> AppSettingsPublic {
        self.get().to_public()
    }

    pub fn update(&self, patch: SettingsPatch) -> Result<AppSettingsPublic> {
        let key_patch = patch.gemini_api_key.clone();
        let mut guard = self.inner.lock().expect("settings mutex poisoned");
        let mut merged = patch.apply_to(guard.clone());

        if let Some(key) = key_patch {
            crate::secrets::set_gemini_api_key(&key)?;
            merged.gemini_api_key = key.trim().to_string();
        }

        *guard = merged.clone();
        merged.persist()?;
        drop(guard);
        Ok(merged.to_public())
    }
}