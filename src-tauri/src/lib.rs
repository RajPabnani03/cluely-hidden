//! Cluely Hidden — application entry point.
//!
//! Wires Tauri plugins, registers IPC commands, creates the overlay window,
//! and installs the global hotkey + tray icon.

mod config;
mod error;
mod window;
mod ipc;
mod settings;

use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::window::helpers;
use crate::window::overlay;
use crate::window::tray;
use crate::settings::SettingsState;

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
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Err(e) = helpers::toggle(app) {
                            log::error!("toggle_overlay failed: {e:#}");
                        }
                    }
                })
                .build(),
        )
        // ---------- State ----------
        .manage(SettingsState::default())
        // ---------- Setup ----------
        .setup(|app| {
            // Create the overlay window (hidden by default)
            overlay::create(&app.handle())?;

            // Create the tray icon
            tray::create(app.handle())?;

            // Register the global hotkey: ⌘+Shift+Space
            let shortcut = Shortcut::new(
                Some(Modifiers::SUPER | Modifiers::SHIFT),
                Code::Space,
            );
            if let Err(e) = app.global_shortcut().register(shortcut) {
                log::error!("failed to register global shortcut: {e:#}");
            } else {
                log::info!("global hotkey registered: ⌘+Shift+Space");
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
