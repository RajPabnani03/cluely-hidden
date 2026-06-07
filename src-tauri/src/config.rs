//! Application configuration and constants.

/// Default global hotkey (Cmd+Shift+Space).
pub const DEFAULT_HOTKEY: &str = "CmdOrCtrl+Shift+Space";

/// App identifier (must match tauri.conf.json).
pub const APP_IDENTIFIER: &str = "com.cluelyhidden.app";

/// User-facing app name.
pub const APP_NAME: &str = "Cluely Hidden";

/// Default model for local inference.
pub const DEFAULT_MODEL: &str = "llama3.2:3b";

/// Returns the app's per-user data directory, creating it if necessary.
///
/// Resolves to `~/Library/Application Support/com.cluelyhidden.app` on macOS,
/// `%APPDATA%\com.cluelyhidden.app` on Windows, and
/// `~/.local/share/com.cluelyhidden.app` on Linux. Falls back to the system
/// temp dir if neither `$HOME` nor platform-specific env vars are set.
///
/// We deliberately avoid pulling in the `dirs` crate — this is a few lines
/// and one fewer dep to audit.
pub fn data_dir() -> std::path::PathBuf {
    #[cfg(target_os = "macos")]
    let base = {
        if let Ok(home) = std::env::var("HOME") {
            std::path::PathBuf::from(home).join("Library/Application Support")
        } else {
            std::env::temp_dir()
        }
    };

    #[cfg(target_os = "windows")]
    let base = {
        if let Ok(roam) = std::env::var("APPDATA") {
            std::path::PathBuf::from(roam)
        } else {
            std::env::temp_dir()
        }
    };

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let base = {
        if let Ok(home) = std::env::var("HOME") {
            std::path::PathBuf::from(home).join(".local/share")
        } else if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
            std::path::PathBuf::from(xdg)
        } else {
            std::env::temp_dir()
        }
    };

    base.join(APP_IDENTIFIER)
}
