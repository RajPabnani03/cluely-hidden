//! Apply stealth presentation tiers — Ghost / Glass / Focus.

use tauri::{AppHandle, Emitter};

use crate::error::Result;
use crate::settings::{SettingsPatch, SettingsState};
use crate::window::layout::{self, LAYOUT_COMPACT, LAYOUT_FULL};

pub const TIER_GHOST: &str = "ghost";
pub const TIER_GLASS: &str = "glass";
pub const TIER_FOCUS: &str = "focus";

pub fn next_tier(current: &str) -> &'static str {
    match current {
        TIER_GHOST => TIER_GLASS,
        TIER_GLASS => TIER_FOCUS,
        _ => TIER_GHOST,
    }
}

pub fn apply_stealth_tier(
    app: &AppHandle,
    settings: &SettingsState,
    tier: &str,
) -> Result<()> {
    let tier = match tier {
        TIER_GHOST | TIER_GLASS | TIER_FOCUS => tier,
        _ => TIER_GLASS,
    };

    let (layout, opacity) = match tier {
        TIER_GHOST => (LAYOUT_COMPACT, 0.55),
        TIER_GLASS => (LAYOUT_FULL, 0.92),
        TIER_FOCUS => (LAYOUT_FULL, 1.0),
        _ => (LAYOUT_FULL, 0.92),
    };

    let patch = SettingsPatch {
        stealth_tier: Some(tier.to_string()),
        overlay_layout: Some(layout.to_string()),
        overlay_opacity: Some(opacity),
        ..Default::default()
    };
    settings.update(patch)?;
    layout::apply_layout(app, layout)?;
    let _ = app.emit("overlay:stealth_tier", tier);
    Ok(())
}

pub fn cycle_stealth_tier(app: &AppHandle, settings: &SettingsState) -> Result<()> {
    let current = settings.get().stealth_tier;
    let next = next_tier(&current);
    apply_stealth_tier(app, settings, next)
}