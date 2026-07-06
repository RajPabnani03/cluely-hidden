//! Overlay layout (full card vs compact pill) and stealth tier sizing.

use tauri::{AppHandle, Emitter, Manager, PhysicalSize};

use crate::error::Result;
use crate::window::overlay::OVERLAY_LABEL;

pub const LAYOUT_FULL: &str = "full";
pub const LAYOUT_COMPACT: &str = "compact";

pub fn apply_layout(app: &AppHandle, layout: &str) -> Result<()> {
    let Some(win) = app.get_webview_window(OVERLAY_LABEL) else {
        return Ok(());
    };
    let (w, h) = if layout == LAYOUT_COMPACT {
        (320.0, 56.0)
    } else {
        (420.0, 600.0)
    };
    win.set_size(PhysicalSize::new(w, h))?;
    let _ = app.emit("overlay:layout", layout);
    Ok(())
}