//! Application error type. Used as the `Result` alias throughout.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("serde error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("window '{0}' not found")]
    WindowNotFound(String),

    #[error("settings error: {0}")]
    Settings(String),

    #[error("{0}")]
    Other(String),
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
