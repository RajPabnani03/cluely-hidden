//! The stealth overlay window — the heart of the app.

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::error::Result;

/// Window label used throughout the app to refer to the overlay.
pub const OVERLAY_LABEL: &str = "main";

/// Create the overlay window. Starts hidden — toggle via hotkey or tray.
pub fn create(app: &AppHandle) -> Result<()> {
    // Don't recreate if it already exists
    if app.get_webview_window(OVERLAY_LABEL).is_some() {
        log::debug!("overlay window already exists");
        return Ok(());
    }

    WebviewWindowBuilder::new(app, OVERLAY_LABEL, WebviewUrl::App("index.html".into()))
        .title("Cluely Hidden")
        .inner_size(420.0, 600.0)
        .min_inner_size(360.0, 480.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .focused(false)
        .shadow(true)
        .build()?;

    log::info!("overlay window created");
    Ok(())
}

/// Position the overlay near the bottom-right of the primary monitor.
pub fn position_bottom_right(app: &AppHandle) -> Result<()> {
    if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
        if let Ok(monitor) = win.primary_monitor() {
            if let Some(m) = monitor {
                let size = m.size();
                let scale = m.scale_factor();
                let win_w = (420.0 * scale) as i32;
                let win_h = (600.0 * scale) as i32;
                let margin = (24.0 * scale) as i32;
                let x = (size.width as i32) - win_w - margin;
                let y = (size.height as i32) - win_h - margin;
                let _ = win.set_position(tauri::Position::Physical(
                    tauri::PhysicalPosition { x, y },
                ));
            }
        }
    }
    Ok(())
}
