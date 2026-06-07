//! Cluely Hidden — application entry point.
//!
//! Wires Tauri plugins, registers IPC commands, creates the overlay window,
//! and installs the global hotkey + tray icon.

mod config;
mod error;
mod window;
mod ipc;
mod settings;
mod hotkeys;

use tauri_plugin_global_shortcut::ShortcutState;

use crate::hotkeys::registry::HotkeyState;
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
                .build(),
        )
        // ---------- State ----------
        .manage(SettingsState::default())
        .manage(HotkeyState::default())
        // ---------- Setup ----------
        .setup(|app| {
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
            {
                let state = app.state::<HotkeyState>();
                let registry = state.0.lock().expect("hotkey mutex poisoned");
                if let Err(e) = registry.register_all(app.handle()) {
                    log::error!("failed to register hotkeys: {e:#}");
                }
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
