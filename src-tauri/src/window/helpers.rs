//! Window-level helpers: show/hide/toggle, click-through, settings window.

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::error::Result;
use crate::window::overlay::OVERLAY_LABEL;

/// Show the overlay window. Repositions to bottom-right and focuses.
pub fn show(app: &AppHandle) -> Result<()> {
    crate::window::overlay::position_bottom_right(app)?;
    if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
        win.show()?;
        win.set_focus()?;
        let _ = app.emit("overlay:visibility", true);
    } else {
        return Err(crate::error::AppError::WindowNotFound(OVERLAY_LABEL.to_string()).into());
    }
    Ok(())
}

/// Hide the overlay window. Emits visibility event for the React store.
pub fn hide(app: &AppHandle) -> Result<()> {
    if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
        win.hide()?;
        let _ = app.emit("overlay:visibility", false);
    }
    Ok(())
}

/// Toggle the overlay window's visibility.
pub fn toggle(app: &AppHandle) -> Result<()> {
    if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
        match win.is_visible() {
            Ok(true) => hide(app),
            _ => show(app),
        }
    } else {
        show(app)
    }
}

/// Set whether the overlay ignores pointer events.
pub fn set_click_through(app: &AppHandle, enabled: bool) -> Result<()> {
    if let Some(win) = app.get_webview_window(OVERLAY_LABEL) {
        win.set_ignore_cursor_events(enabled)?;
        let _ = app.emit("overlay:click_through", enabled);
    }
    Ok(())
}

/// Toggle click-through and sync managed chrome state.
pub fn toggle_click_through(
    app: &AppHandle,
    chrome: &crate::window::OverlayChromeState,
) -> Result<()> {
    let mut inner = chrome.0.lock().expect("overlay chrome mutex poisoned");
    inner.click_through = !inner.click_through;
    let enabled = inner.click_through;
    drop(inner);
    set_click_through(app, enabled)
}

/// Open (or focus) the settings window.
pub fn open_settings(app: &AppHandle) -> Result<()> {
    const SETTINGS_LABEL: &str = "settings";

    if let Some(existing) = app.get_webview_window(SETTINGS_LABEL) {
        existing.show()?;
        existing.set_focus()?;
        return Ok(());
    }

    WebviewWindowBuilder::new(app, SETTINGS_LABEL, WebviewUrl::App("settings.html".into()))
        .title("Cluely Hidden — Settings")
        .inner_size(600.0, 500.0)
        .min_inner_size(480.0, 400.0)
        .decorations(true)
        .resizable(true)
        .skip_taskbar(false)
        .center()
        .build()?;

    Ok(())
}

/// Quit the entire app. Wired to tray menu.
pub fn quit(app: &AppHandle) {
    app.exit(0);
}
