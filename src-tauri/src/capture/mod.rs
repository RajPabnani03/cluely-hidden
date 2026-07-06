//! Screen-capture pipeline.
//!
//! Provides [`CaptureMeta`] (the on-disk + DB record of a capture) and
//! [`capture_primary_display`], which grabs the primary monitor, encodes
//! it as PNG, and persists it under the app's data directory.
//!
//! Audio capture will live here too in a later phase (`capture::audio`),
//! but for now this module only owns screenshots.

pub mod screen;

pub use screen::{capture_primary_display, CaptureMeta};