//! macOS menu-bar tray icon. Right-click menu gives the user a way to
//! summon the overlay, open settings, or quit — even when the overlay
//! itself is hidden.

use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::window::helpers;
use crate::window::helpers as overlay_cmd;

const TRAY_ID: &str = "main-tray";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    // Load the tray icon from the embedded PNG. Tauri 2.11's `Image::from_path`
    // accepts a path resolved relative to the app bundle. For dev we resolve
    // from the current directory.
    let icon = load_tray_icon(app).unwrap_or_else(|| {
        log::warn!("tray icon not found, using empty 16x16");
        // Minimal valid 16x16 transparent RGBA buffer
        Image::new_owned(vec![0u8; 16 * 16 * 4], 16, 16)
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
                if let Err(e) = overlay_cmd::toggle(app) {
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
                if let Err(e) = overlay_cmd::toggle(app) {
                    log::error!("tray click toggle failed: {e:#}");
                }
            }
        })
        .build(app)?;

    log::info!("tray icon created");
    Ok(())
}

/// Load the tray icon. Tries multiple locations in order:
/// 1. Bundled resource path (production)
/// 2. Workspace dev path (development)
/// 3. Falls back to None if neither is found
fn load_tray_icon(app: &AppHandle) -> Option<Image<'static>> {
    let candidates: Vec<std::path::PathBuf> = vec![
        // Bundled: tauri.conf.json resource path
        app.path()
            .resource_dir()
            .ok()
            .map(|p| p.join("icons/tray-icon.png"))
            .unwrap_or_default(),
        // Dev: relative to workspace root
        std::path::PathBuf::from("src-tauri/icons/tray-icon.png"),
        std::path::PathBuf::from("../src-tauri/icons/tray-icon.png"),
    ];

    for path in &candidates {
        if path.exists() {
            match Image::from_path(path) {
                Ok(img) => {
                    log::info!("tray icon loaded from {}", path.display());
                    return Some(img);
                }
                Err(e) => log::warn!("failed to load tray icon from {}: {e}", path.display()),
            }
        }
    }
    None
}
