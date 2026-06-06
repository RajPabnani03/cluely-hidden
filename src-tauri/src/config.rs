//! Application configuration and constants.

/// Default global hotkey (Cmd+Shift+Space).
pub const DEFAULT_HOTKEY: &str = "CmdOrCtrl+Shift+Space";

/// App identifier (must match tauri.conf.json).
pub const APP_IDENTIFIER: &str = "com.cluelyhidden.app";

/// User-facing app name.
pub const APP_NAME: &str = "Cluely Hidden";

/// Default model for local inference.
pub const DEFAULT_MODEL: &str = "llama3.2:3b";
