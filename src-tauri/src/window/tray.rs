//! macOS menu-bar tray icon. Right-click menu gives the user a way to
//! summon the overlay, open settings, or quit — even when the overlay
//! itself is hidden.

use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::window::{helpers, overlay};

const TRAY_ID: &str = "main-tray";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    // Load the tray icon. Falls back to a transparent placeholder if not present.
    let icon = Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
        .unwrap_or_else(|_| {
            log::warn!("tray icon not found, using default");
            Image::from_bytes(DEFAULT_TRAY).expect("default tray icon must be valid")
        });

    let show_item = MenuItem::with_id(app, "show", "Show / Hide Overlay", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Cluely", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&show_item, &sep1, &settings_item, &sep2, &quit_item],
    )?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .tooltip("Cluely Hidden")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Err(e) = overlay::toggle(app) {
                    log::error!("tray toggle failed: {e:#}");
                }
            }
            "settings" => {
                if let Err(e) = helpers::open_settings(app) {
                    log::error!("open_settings failed: {e:#}");
                }
            }
            "quit" => helpers::quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click on tray icon also toggles the overlay
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Err(e) = overlay::toggle(app) {
                    log::error!("tray click toggle failed: {e:#}");
                }
            }
        })
        .build(app)?;

    log::info!("tray icon created");
    Ok(())
}

/// 16x16 template-style placeholder tray icon. Black on transparent.
const DEFAULT_TRAY: &[u8] = include_bytes!("../../icons/tray-icon.png");
