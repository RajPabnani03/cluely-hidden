//! Application error type. Used as the `Result` alias throughout.

use thiserror::Error;

/// Errors produced by the screen-capture pipeline.
///
/// Kept separate from [`AppError`] so the capture module doesn't have to
/// know about every other error variant in the app, and so a future
/// audio-capture variant can live alongside it without bloating `AppError`.
#[derive(Debug, Error)]
pub enum CaptureError {
    #[error("monitor enumeration failed: {0}")]
    MonitorEnumeration(String),

    #[error("screen capture failed: {0}")]
    CaptureFailed(String),

    #[error("png encode failed: {0}")]
    EncodeFailed(String),

    #[error("io error: {0}")]
    IoError(String),

    #[error("no input audio device available")]
    NoInputDevice,

    #[error("failed to build input audio stream: {0}")]
    StreamBuildFailed(String),

    #[error("audio resampling failed: {0}")]
    ResampleFailed(String),

    #[error("cpal error: {0}")]
    Cpal(String),

    #[error("audio stream config error: {0}")]
    AudioConfig(String),
}

#[derive(Debug, Error)]
pub enum AppError {
    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("global shortcut error: {0}")]
    GlobalShortcut(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("serde error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("window '{0}' not found")]
    WindowNotFound(String),

    #[error("settings error: {0}")]
    Settings(String),

    #[error("database error: {0}")]
    Database(String),

    #[error("rusqlite error: {0}")]
    Rusqlite(#[from] rusqlite::Error),

    #[error("{0}")]
    Other(String),
}

// Bridge tauri-plugin-global-shortcut errors to our AppError
impl From<tauri_plugin_global_shortcut::Error> for AppError {
    fn from(e: tauri_plugin_global_shortcut::Error) -> Self {
        AppError::GlobalShortcut(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Other(s)
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Other(s.to_string())
    }
}

// Tauri requires command return types to be Serialize.
// We serialize AppError as a string for the frontend.
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
