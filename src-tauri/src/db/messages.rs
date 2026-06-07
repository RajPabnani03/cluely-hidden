//! `messages` table CRUD.
//!
//! Messages are append-only. Each message belongs to exactly one
//! conversation and is rendered in the transcript view. We also store
//! the audio transcript (Gemini's STT output) and an optional reference
//! to a screenshot capture that was attached to the turn.

use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    /// "user" | "assistant" | "system" — enforced by CHECK in the schema.
    pub role: String,
    pub content: String,
    pub audio_transcript: Option<String>,
    pub screenshot_id: Option<String>,
    pub model: Option<String>,
    pub tokens_in: Option<i64>,
    pub tokens_out: Option<i64>,
    pub created_at: i64,
}

/// All messages in a conversation, oldest-first (chronological order
/// for the transcript). Uses `idx_messages_conversation` for speed.
pub fn list_for_conversation(conn: &Connection, conversation_id: &str) -> Result<Vec<Message>> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, role, content, audio_transcript, screenshot_id, \
                model, tokens_in, tokens_out, created_at \
         FROM messages WHERE conversation_id = ?1 \
         ORDER BY created_at ASC, id ASC",
    )?;
    let rows = stmt.query_map(params![conversation_id], row_to_message)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// Append a new message. Returns the persisted row (with id + ts).
///
/// Note: we do **not** bump the conversation's `updated_at` here —
/// callers (the chat pipeline) should call `conversations::touch`
/// separately so multiple inserts in one turn only bump the timestamp
/// once.
pub fn create(
    conn: &Connection,
    conversation_id: String,
    role: String,
    content: String,
    audio_transcript: Option<String>,
    screenshot_id: Option<String>,
    model: Option<String>,
) -> Result<Message> {
    let now = chrono::Utc::now().timestamp_millis();
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO messages \
            (id, conversation_id, role, content, audio_transcript, screenshot_id, \
             model, tokens_in, tokens_out, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL, ?8)",
        params![
            id,
            conversation_id,
            role,
            content,
            audio_transcript,
            screenshot_id,
            model,
            now
        ],
    )?;

    Ok(Message {
        id,
        conversation_id,
        role,
        content,
        audio_transcript,
        screenshot_id,
        model,
        tokens_in: None,
        tokens_out: None,
        created_at: now,
    })
}

fn row_to_message(row: &Row<'_>) -> rusqlite::Result<Message> {
    Ok(Message {
        id: row.get("id")?,
        conversation_id: row.get("conversation_id")?,
        role: row.get("role")?,
        content: row.get("content")?,
        audio_transcript: row.get("audio_transcript")?,
        screenshot_id: row.get("screenshot_id")?,
        model: row.get("model")?,
        tokens_in: row.get("tokens_in")?,
        tokens_out: row.get("tokens_out")?,
        created_at: row.get("created_at")?,
    })
}
