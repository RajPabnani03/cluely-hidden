//! Cluely Hidden — application entry point.
//!
//! Wires Tauri plugins, registers IPC commands, creates the overlay window,
//! and installs the global hotkey + tray icon.

mod config;
mod db;
mod error;
mod window;
mod ipc;
mod settings;
mod hotkeys;
mod ai;
mod capture;
mod audio;

use tauri::Manager;

use crate::hotkeys::registry::HotkeyState;
use crate::window::overlay;
use crate::window::tray;
use crate::settings::SettingsState;
use crate::db::DbState;
use crate::ipc::commands::{AiState, MicState};

pub fn run() {
    // Initialize logging (controlled by RUST_LOG env var)
    let _ = env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info"),
    )
    .try_init();

    log::info!("cluely-hidden v{} starting", env!("CARGO_PKG_VERSION"));

    tauri::Builder::default()
        // ---------- Plugins ----------
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .build(),
        )
        // ---------- State ----------
        .manage(SettingsState::default())
        .manage(HotkeyState::default())
        .manage(AiState::default())
        .manage(MicState::default())
        // ---------- Setup ----------
        .setup(|app| {
            // ---------- Phase 3A — Database ----------
            // Open (or create) the SQLite database, apply migrations, seed
            // the 6 builtin profiles, and stash the connection in managed
            // state so IPC commands can grab it with `tauri::State<DbState>`.
            let db_path = config::data_dir().join("cluely.db");
            let conn = db::open(&db_path).map_err(|e| {
                log::error!("failed to open db at {}: {e:#}", db_path.display());
                e
            })?;
            db::migrate(&conn)?;
            db::seed_builtin_profiles(&conn)?;
            app.manage(DbState(std::sync::Mutex::new(conn)));
            log::info!("database initialized at {}", db_path.display());

            // ---------- Phase 1 — P0 Stealth ----------
            // On macOS, set the activation policy to Accessory BEFORE creating
            // the overlay window. This hides the app from the Dock and the
            // Cmd+Tab app switcher. The tray icon remains visible (it's an
            // NSStatusItem, not a Dock tile). `set_activation_policy` is a
            // method on `App` (not `AppHandle`) and is `#[cfg(target_os =
            // "macos")]` in tauri, so we gate the call accordingly.
            #[cfg(target_os = "macos")]
            {
                if let Err(e) = app
                    .handle()
                    .set_activation_policy(tauri::ActivationPolicy::Accessory)
                {
                    log::error!("failed to set ActivationPolicy::Accessory: {e:#}");
                } else {
                    log::info!("activation policy set to Accessory (hidden from Dock & Cmd+Tab)");
                }
            }

            // Create the overlay window (hidden by default).
            // Stealth posture is configured inside overlay::create — see
            // content_protected, title_bar_style, hidden_title.
            overlay::create(&app.handle())?;

            // Create the tray icon (the only visible UI presence).
            tray::create(app.handle())?;

            // Register all 11 hotkeys via the registry
            let registry = app.state::<HotkeyState>();
            let registry = registry.0.lock().expect("hotkey mutex poisoned");
            if let Err(e) = registry.register_all(app.handle()) {
                log::error!("failed to register hotkeys: {e:#}");
            }

            log::info!("setup complete");
            Ok(())
        })
        // ---------- IPC commands ----------
        .invoke_handler(tauri::generate_handler![
            ipc::commands::toggle_overlay,
            ipc::commands::show_overlay,
            ipc::commands::hide_overlay,
            ipc::commands::set_click_through,
            ipc::commands::open_settings,
            ipc::commands::quit_app,
            ipc::commands::get_settings,
            ipc::commands::update_settings,
            ipc::commands::chat,
            ipc::commands::get_hotkey_bindings,
            ipc::commands::rebind_hotkey,
            // ---- Phase 3A — Database ----
            ipc::commands::list_profiles,
            ipc::commands::get_profile,
            ipc::commands::create_profile,
            ipc::commands::update_profile,
            ipc::commands::delete_profile,
            ipc::commands::list_conversations,
            ipc::commands::create_conversation,
            ipc::commands::update_conversation_title,
            ipc::commands::delete_conversation,
            ipc::commands::list_messages,
            ipc::commands::save_message,
            ipc::commands::create_capture,
            ipc::commands::get_capture,
            // ---- Phase 3B — Capture pipeline ----
            ipc::commands::capture_screen,
            // ---- Phase 5 — AI Live (Gemini bidi WebSocket) ----
            ipc::commands::ai_start_live,
            ipc::commands::ai_start_live_configured,
            ipc::commands::ai_send_audio,
            ipc::commands::ai_stop_live,
            // ---- Phase 6 — Microphone capture pipeline ----
            ipc::commands::mic_start,
            ipc::commands::mic_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
