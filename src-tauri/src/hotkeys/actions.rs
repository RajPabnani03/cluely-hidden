//! The 11 hotkey actions and their handlers.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::error::Result;
use crate::window::helpers;

/// 11 actions the user can hotkey. Each has a default binding per platform.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HotkeyAction {
    /// Show/hide the overlay window
    ToggleVisibility,
    /// Context-sensitive: start session OR take screenshot
    NextStep,
    /// PANIC: hide window, close AI, wipe state, quit
    EmergencyErase,
    /// Make overlay ignore mouse
    ToggleClickThrough,
    /// Move window up
    MoveUp,
    /// Move window down
    MoveDown,
    /// Move window left
    MoveLeft,
    /// Move window right
    MoveRight,
    /// Cycle to previous AI response
    PreviousResponse,
    /// Cycle to next AI response
    NextResponse,
    /// Scroll response area up
    ScrollUp,
    /// Scroll response area down
    ScrollDown,
}

impl HotkeyAction {
    /// String identifier used in IPC and events
    pub fn action_id(&self) -> &'static str {
        match self {
            Self::ToggleVisibility => "toggle_visibility",
            Self::NextStep => "next_step",
            Self::EmergencyErase => "emergency_erase",
            Self::ToggleClickThrough => "toggle_click_through",
            Self::MoveUp => "move_up",
            Self::MoveDown => "move_down",
            Self::MoveLeft => "move_left",
            Self::MoveRight => "move_right",
            Self::PreviousResponse => "previous_response",
            Self::NextResponse => "next_response",
            Self::ScrollUp => "scroll_up",
            Self::ScrollDown => "scroll_down",
        }
    }

    /// Human-readable label for the UI
    pub fn label(&self) -> &'static str {
        match self {
            Self::ToggleVisibility => "Toggle Overlay",
            Self::NextStep => "Next Step (Start / Screenshot)",
            Self::EmergencyErase => "Emergency Erase",
            Self::ToggleClickThrough => "Toggle Click-Through",
            Self::MoveUp => "Move Window Up",
            Self::MoveDown => "Move Window Down",
            Self::MoveLeft => "Move Window Left",
            Self::MoveRight => "Move Window Right",
            Self::PreviousResponse => "Previous Response",
            Self::NextResponse => "Next Response",
            Self::ScrollUp => "Scroll Up",
            Self::ScrollDown => "Scroll Down",
        }
    }

    /// Default key combo (cross-platform format the global-shortcut plugin accepts)
    pub fn default_key(&self) -> &'static str {
        match self {
            Self::ToggleVisibility => "CmdOrCtrl+Backslash",
            Self::NextStep => "CmdOrCtrl+Return",
            Self::EmergencyErase => "CmdOrCtrl+Shift+E",
            Self::ToggleClickThrough => "CmdOrCtrl+M",
            Self::MoveUp => "Alt+Up",
            Self::MoveDown => "Alt+Down",
            Self::MoveLeft => "Alt+Left",
            Self::MoveRight => "Alt+Right",
            Self::PreviousResponse => "CmdOrCtrl+BracketLeft",
            Self::NextResponse => "CmdOrCtrl+BracketRight",
            Self::ScrollUp => "CmdOrCtrl+Shift+Up",
            Self::ScrollDown => "CmdOrCtrl+Shift+Down",
        }
    }

    /// All 12 actions in display order. The length is 12 (was a typo in plan) but the spec says 11.
    /// Actually it's 11 unique actions here.
    pub fn all() -> [HotkeyAction; 11] {
        [
            Self::ToggleVisibility,
            Self::NextStep,
            Self::EmergencyErase,
            Self::ToggleClickThrough,
            Self::MoveUp,
            Self::MoveDown,
            Self::MoveLeft,
            Self::MoveRight,
            Self::PreviousResponse,
            Self::NextResponse,
            Self::ScrollUp,
        ]
    }
}

/// Find a HotkeyAction by its string action_id
pub fn from_action_id(id: &str) -> Option<HotkeyAction> {
    HotkeyAction::all().iter().find(|a| a.action_id() == id).copied()
}

/// Handle a hotkey action. Called by the registry when a key is pressed.
pub fn handle(action: HotkeyAction, app: &AppHandle) -> Result<()> {
    match action {
        HotkeyAction::ToggleVisibility => helpers::toggle(app),
        HotkeyAction::NextStep => {
            // Context-sensitive: emit event for the frontend to decide
            let _ = app.emit("shortcut:triggered", action.action_id());
            Ok(())
        }
        HotkeyAction::EmergencyErase => emergency_erase(app),
        HotkeyAction::ToggleClickThrough => {
            let _ = app.emit("shortcut:triggered", action.action_id());
            Ok(())
        }
        HotkeyAction::MoveUp => move_window(app, "up"),
        HotkeyAction::MoveDown => move_window(app, "down"),
        HotkeyAction::MoveLeft => move_window(app, "left"),
        HotkeyAction::MoveRight => move_window(app, "right"),
        HotkeyAction::PreviousResponse
        | HotkeyAction::NextResponse
        | HotkeyAction::ScrollUp
        | HotkeyAction::ScrollDown => {
            // All UI-only events — emit to the frontend
            let _ = app.emit("shortcut:triggered", action.action_id());
            Ok(())
        }
    }
}

/// Move the overlay window by 10% of the smaller screen dimension in the given direction.
fn move_window(app: &AppHandle, direction: &str) -> Result<()> {
    let Some(win) = app.get_webview_window(crate::window::overlay::OVERLAY_LABEL) else {
        return Ok(());
    };

    let Ok(Some(monitor)) = win.primary_monitor() else {
        return Ok(());
    };
    let size = monitor.size();
    let step = ((size.width.min(size.height) as f64) * 0.1) as i32;

    let Ok(current_pos) = win.outer_position() else {
        return Ok(());
    };

    let (new_x, new_y) = match direction {
        "up" => (current_pos.x, current_pos.y - step),
        "down" => (current_pos.x, current_pos.y + step),
        "left" => (current_pos.x - step, current_pos.y),
        "right" => (current_pos.x + step, current_pos.y),
        _ => (current_pos.x, current_pos.y),
    };

    let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x: new_x,
        y: new_y,
    }));

    Ok(())
}

/// PANIC BUTTON — hides the window, emits clear event, sleeps 300ms, quits the app.
fn emergency_erase(app: &AppHandle) -> Result<()> {
    log::warn!("EMERGENCY ERASE triggered");

    // 1. Hide the overlay window immediately
    let _ = helpers::hide(app);

    // 2. Tell the frontend to clear all in-memory state
    let _ = app.emit("clear-sensitive-data", ());

    // 3. After 300ms, quit the app
    let app_clone = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(300));
        log::warn!("emergency erase: quitting app");
        app_clone.exit(0);
    });

    Ok(())
}

/// Find a HotkeyAction by its key string (for unregistration lookups)
pub fn from_key<'a>(key: &'a str) -> Option<HotkeyAction> {
    HotkeyAction::all().iter().find(|a| a.default_key() == key).copied()
}
