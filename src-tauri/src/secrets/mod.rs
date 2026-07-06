//! macOS Keychain (and cross-platform keyring) for secrets — never written to settings.json.

use crate::config::APP_IDENTIFIER;
use crate::error::{AppError, Result};

const GEMINI_KEY_USER: &str = "gemini_api_key";

pub fn get_gemini_api_key() -> Result<Option<String>> {
    let entry = keyring::Entry::new(APP_IDENTIFIER, GEMINI_KEY_USER)
        .map_err(|e| AppError::Other(format!("keychain entry: {e}")))?;
    match entry.get_password() {
        Ok(p) if p.trim().is_empty() => Ok(None),
        Ok(p) => Ok(Some(p)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Other(format!("keychain read: {e}"))),
    }
}

pub fn set_gemini_api_key(key: &str) -> Result<()> {
    let entry = keyring::Entry::new(APP_IDENTIFIER, GEMINI_KEY_USER)
        .map_err(|e| AppError::Other(format!("keychain entry: {e}")))?;
    let trimmed = key.trim();
    if trimmed.is_empty() {
        let _ = entry.delete_credential();
        return Ok(());
    }
    entry
        .set_password(trimmed)
        .map_err(|e| AppError::Other(format!("keychain write: {e}")))
}

/// Remove Gemini key from Keychain (e.g. user clears field).
pub fn clear_gemini_api_key() -> Result<()> {
    set_gemini_api_key("")
}