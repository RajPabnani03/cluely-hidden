//! Click-through and other overlay chrome state.

use std::sync::Mutex;

#[derive(Debug, Default)]
pub struct OverlayChromeInner {
    pub click_through: bool,
}

#[derive(Debug, Default)]
pub struct OverlayChromeState(pub Mutex<OverlayChromeInner>);