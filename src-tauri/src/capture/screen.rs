//! Primary-display screen capture.
//!
//! Captures the primary monitor via `xcap`, encodes the resulting RGBA
//! buffer as PNG using the `image` crate, writes the file to
//! `<data_dir>/captures/{uuid}.png`, and returns metadata describing
//! what was saved.
//!
//! No DB write happens here — that's the job of the IPC layer, which
//! calls [`capture_primary_display`] and then inserts a `captures` row
//! referencing the returned path.

use std::io::Cursor;
use std::path::{Path, PathBuf};

use chrono::Utc;
use uuid::Uuid;

use crate::config::data_dir;
use crate::error::CaptureError;

/// Metadata describing a single captured screenshot on disk.
///
/// Returned by [`capture_primary_display`] and serialized to the
/// frontend (and emitted as the payload of the `"capture:screen"` event).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CaptureMeta {
    /// UUIDv4 identifying this capture. Matches the `id` column that
    /// the IPC layer inserts into the `captures` table.
    pub id: String,

    /// Absolute path on disk where the PNG was written.
    pub path: PathBuf,

    /// Pixel width of the captured frame.
    pub width: u32,

    /// Pixel height of the captured frame.
    pub height: u32,

    /// Unix epoch (milliseconds) when the capture was taken.
    pub created_at: i64,
}

/// Capture the primary display and write it as a PNG file.
///
/// Steps:
/// 1. Enumerate monitors via `xcap::Monitor::all()`.
/// 2. Find the primary monitor (`is_primary()`).
/// 3. Call `capture_image()` → returns an `image::RgbaImage`.
/// 4. Re-encode as PNG into a `Vec<u8>`.
/// 5. Write the PNG to `<data_dir>/captures/{uuid}.png`.
/// 6. Return a [`CaptureMeta`] describing the result.
pub fn capture_primary_display() -> Result<CaptureMeta, CaptureError> {
    // 1. Enumerate monitors.
    let monitors = xcap::Monitor::all()
        .map_err(|e| CaptureError::MonitorEnumeration(e.to_string()))?;

    // 2. Find the primary monitor.
    let primary = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .ok_or_else(|| {
            CaptureError::MonitorEnumeration("no primary monitor found".to_string())
        })?;

    // 3. Capture the screen (RGBA buffer).
    let rgba_image = primary
        .capture_image()
        .map_err(|e| CaptureError::CaptureFailed(e.to_string()))?;

    let width = rgba_image.width();
    let height = rgba_image.height();

    // 4. Encode to PNG bytes.
    let png_bytes = encode_png(&rgba_image)?;

    // 5. Resolve target path and write.
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().timestamp_millis();
    let path = captures_dir().join(format!("{id}.png"));

    std::fs::create_dir_all(captures_dir())
        .map_err(|e| CaptureError::IoError(e.to_string()))?;
    std::fs::write(&path, &png_bytes)
        .map_err(|e| CaptureError::IoError(e.to_string()))?;

    log::info!(
        "captured primary display: {}x{} → {} ({} bytes)",
        width,
        height,
        path.display(),
        png_bytes.len()
    );

    Ok(CaptureMeta {
        id,
        path,
        width,
        height,
        created_at,
    })
}

/// Encode an RGBA image buffer as a PNG byte vector.
fn encode_png(rgba: &image::RgbaImage) -> Result<Vec<u8>, CaptureError> {
    let mut cursor = Cursor::new(Vec::with_capacity(rgba.len() / 4));
    rgba.write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| CaptureError::EncodeFailed(e.to_string()))?;
    Ok(cursor.into_inner())
}

/// `<data_dir>/captures/` — where PNG screenshots are persisted.
fn captures_dir() -> PathBuf {
    data_dir().join("captures")
}

/// Test-only helper: expose the captures dir resolver so unit tests can
/// assert the layout without taking a real screenshot.
#[allow(dead_code)]
pub(crate) fn captures_dir_for_tests() -> &'static Path {
    // Returns the static `captures` segment; tests combine with their
    // own tempdir. Not used in production.
    Path::new("captures")
}