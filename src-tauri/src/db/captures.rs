//! `captures` table CRUD.
//!
//! Captures are the artifacts we record as part of a session:
//! screenshots of the user's screen and audio recordings from the mic.
//! Messages can reference a capture via `screenshot_id` so the assistant
//! can "see" what the user saw when interpreting the transcript.

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capture {
    pub id: String,
    /// "screen" | "audio" — enforced by CHECK in the schema.
    pub kind: String,
    pub file_path: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration_ms: Option<i64>,
    pub created_at: i64,
}

/// Register a new capture. `width`/`height` only make sense for
/// screenshots; `duration_ms` only for audio. Callers should pass
/// `None` for the irrelevant fields.
pub fn create(
    conn: &Connection,
    kind: String,
    file_path: String,
    width: Option<i32>,
    height: Option<i32>,
    duration_ms: Option<i64>,
) -> Result<Capture> {
    let now = chrono::Utc::now().timestamp_millis();
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO captures (id, kind, file_path, width, height, duration_ms, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, kind, file_path, width, height, duration_ms, now],
    )?;

    Ok(Capture {
        id,
        kind,
        file_path,
        width,
        height,
        duration_ms,
        created_at: now,
    })
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<Capture>> {
    let c = conn
        .query_row(
            "SELECT id, kind, file_path, width, height, duration_ms, created_at \
             FROM captures WHERE id = ?1",
            params![id],
            row_to_capture,
        )
        .optional()?;
    Ok(c)
}

fn row_to_capture(row: &Row<'_>) -> rusqlite::Result<Capture> {
    Ok(Capture {
        id: row.get("id")?,
        kind: row.get("kind")?,
        file_path: row.get("file_path")?,
        width: row.get("width")?,
        height: row.get("height")?,
        duration_ms: row.get("duration_ms")?,
        created_at: row.get("created_at")?,
    })
}
