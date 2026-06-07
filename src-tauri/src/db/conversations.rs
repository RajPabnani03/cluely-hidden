//! `conversations` table CRUD.
//!
//! A conversation is a thread of messages, optionally tied to a
//! profile. Deleting a conversation cascades to its messages
//! (`ON DELETE CASCADE` in the schema).

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: Option<String>,
    pub profile_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// All conversations, newest-first (most recently updated). This is the
/// shape the sidebar wants.
pub fn list(conn: &Connection) -> Result<Vec<Conversation>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, profile_id, created_at, updated_at \
         FROM conversations ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], row_to_conversation)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<Conversation>> {
    let c = conn
        .query_row(
            "SELECT id, title, profile_id, created_at, updated_at \
             FROM conversations WHERE id = ?1",
            params![id],
            row_to_conversation,
        )
        .optional()?;
    Ok(c)
}

/// Create a new empty conversation. `profile_id` is optional — the
/// user can swap profiles mid-conversation by updating the row later.
pub fn create(conn: &Connection, profile_id: Option<String>) -> Result<Conversation> {
    let now = chrono::Utc::now().timestamp_millis();
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO conversations (id, title, profile_id, created_at, updated_at) \
         VALUES (?1, NULL, ?2, ?3, ?3)",
        params![id, profile_id, now],
    )?;

    Ok(Conversation {
        id,
        title: None,
        profile_id,
        created_at: now,
        updated_at: now,
    })
}

/// Rename a conversation. Pass empty string to clear the title.
pub fn update_title(conn: &Connection, id: &str, title: String) -> Result<()> {
    let title_opt = if title.is_empty() { None } else { Some(title) };
    let now = chrono::Utc::now().timestamp_millis();
    let changed = conn.execute(
        "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title_opt, now, id],
    )?;
    if changed == 0 {
        return Err(AppError::Database(format!("conversation {id} not found")));
    }
    Ok(())
}

/// Bump `updated_at` — call this whenever a message is added so the
/// conversation floats to the top of the sidebar.
pub fn touch(conn: &Connection, id: &str) -> Result<()> {
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

/// Delete a conversation. Messages cascade.
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let changed = conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::Database(format!("conversation {id} not found")));
    }
    Ok(())
}

fn row_to_conversation(row: &Row<'_>) -> rusqlite::Result<Conversation> {
    Ok(Conversation {
        id: row.get("id")?,
        title: row.get("title")?,
        profile_id: row.get("profile_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
