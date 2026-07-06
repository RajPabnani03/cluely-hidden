//! Hotkey registry — owns the bindings map, registers/unregisters with the global-shortcut plugin.

use std::collections::HashMap;
use std::sync::Mutex;

use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::error::Result;
use crate::hotkeys::actions::{self, HotkeyAction};

/// Owns the current key→action bindings. Stored in Tauri's managed state as `Mutex<HotkeyRegistry>`.
#[derive(Debug)]
pub struct HotkeyRegistry {
    /// action -> key string (e.g. "Cmd+Shift+E")
    bindings: HashMap<HotkeyAction, String>,
}

impl HotkeyRegistry {
    /// New registry with all defaults
    pub fn new() -> Self {
        Self::new_with_overrides(&std::collections::HashMap::new())
    }

    pub fn new_with_overrides(overrides: &std::collections::HashMap<String, String>) -> Self {
        let mut bindings = HashMap::new();
        for action in HotkeyAction::all() {
            let key = overrides
                .get(action.action_id())
                .cloned()
                .unwrap_or_else(|| action.default_key().to_string());
            bindings.insert(action, key);
        }
        Self { bindings }
    }

    /// Snapshot of current bindings as (action_id, key) pairs
    pub fn current_bindings(&self) -> Vec<(String, String)> {
        self.bindings
            .iter()
            .map(|(a, k)| (a.action_id().to_string(), k.clone()))
            .collect()
    }

    /// Returns the key currently bound to the given action
    pub fn key_for(&self, action: HotkeyAction) -> Option<String> {
        self.bindings.get(&action).cloned()
    }

    /// Register all 11 hotkeys with the global shortcut plugin.
    ///
    /// Uses `on_shortcut` per-key so each handler knows which action it serves.
    /// Existing registrations for these keys are replaced by the plugin.
    pub fn register_all(&self, app: &AppHandle) -> Result<()> {
        for (action, key) in &self.bindings {
            let action_id = action.action_id();
            let key_owned = key.clone();
            let action_copy = *action;

            // Build the Shortcut value once
            let shortcut: Shortcut = key_owned
                .parse()
                .map_err(|e| crate::error::AppError::Other(format!("invalid key '{key_owned}': {e}")))?;

            app.global_shortcut()
                .on_shortcut(shortcut, move |app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Err(e) = actions::handle(action_copy, app) {
                            log::error!("hotkey {action_id} handler failed: {e:#}");
                        }
                    }
                })
                .map_err(crate::error::AppError::from)?;
        }

        log::info!(
            "registered {} hotkeys: {}",
            self.bindings.len(),
            self.bindings
                .values()
                .cloned()
                .collect::<Vec<_>>()
                .join(", ")
        );
        Ok(())
    }

    /// Unregister all current hotkeys
    pub fn unregister_all(&self, app: &AppHandle) -> Result<()> {
        for key in self.bindings.values() {
            let shortcut: Shortcut = key
                .parse()
                .map_err(|e| crate::error::AppError::Other(format!("invalid key '{key}': {e}")))?;
            let _ = app.global_shortcut().unregister(shortcut);
        }
        log::info!("unregistered {} hotkeys", self.bindings.len());
        Ok(())
    }

    /// Rebind a single action to a new key. Unregisters the old key (if different),
    /// updates the map, and registers the new key.
    pub fn rebind(
        &mut self,
        app: &AppHandle,
        action: HotkeyAction,
        new_key: String,
    ) -> Result<()> {
        // Validate the new key by parsing it
        let new_shortcut: Shortcut = new_key
            .parse()
            .map_err(|e| crate::error::AppError::Other(format!("invalid key '{new_key}': {e}")))?;

        // Unregister the old key
        if let Some(old_key) = self.bindings.get(&action) {
            if old_key != &new_key {
                let old_shortcut: Shortcut = old_key.parse().map_err(|e| {
                    crate::error::AppError::Other(format!("invalid old key '{old_key}': {e}"))
                })?;
                let _ = app.global_shortcut().unregister(old_shortcut);
            }
        }

        // Update the map
        self.bindings.insert(action, new_key.clone());

        // Register the new key with the new handler
        let action_id = action.action_id();
        let key_owned = new_key.clone();
        let action_copy = action;
        app.global_shortcut()
            .on_shortcut(new_shortcut, move |app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Err(e) = actions::handle(action_copy, app) {
                        log::error!("hotkey {action_id} handler failed: {e:#}");
                    }
                }
            })
            .map_err(crate::error::AppError::from)?;

        log::info!("rebound {action_id} to {key_owned}");
        Ok(())
    }
}

impl Default for HotkeyRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Wrapper so we can register it in Tauri state with interior mutability.
/// Tauri state is `&T`, so we need `Mutex<HotkeyRegistry>` for `rebind` to work.
pub struct HotkeyState(pub Mutex<HotkeyRegistry>);

impl Default for HotkeyState {
    fn default() -> Self {
        Self(Mutex::new(HotkeyRegistry::new()))
    }
}
