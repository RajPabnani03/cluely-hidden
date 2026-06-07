//! `profiles` table CRUD.
//!
//! Profiles describe "modes" the assistant can run in (interview, sales,
//! exam, ...). 6 of them are seeded as `is_builtin = 1` on first launch
//! and cannot be deleted; users can add custom profiles (e.g. "Standup
//! with my team — focus on blockers") that they fully own.

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub system_prompt: String,
    pub is_builtin: bool,
    pub position: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

/// All profiles, ordered by `position` then `created_at` (stable).
pub fn list(conn: &Connection) -> Result<Vec<Profile>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, system_prompt, is_builtin, position, created_at, updated_at \
         FROM profiles ORDER BY position ASC, created_at ASC",
    )?;
    let rows = stmt.query_map([], row_to_profile)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get(conn: &Connection, id: &str) -> Result<Option<Profile>> {
    let p = conn
        .query_row(
            "SELECT id, name, system_prompt, is_builtin, position, created_at, updated_at \
             FROM profiles WHERE id = ?1",
            params![id],
            row_to_profile,
        )
        .optional()?;
    Ok(p)
}

/// Create a new custom (non-builtin) profile. The frontend owns the
/// system_prompt content; we just persist what it sends.
pub fn create(conn: &Connection, name: String, system_prompt: String) -> Result<Profile> {
    let now = chrono::Utc::now().timestamp_millis();
    let id = Uuid::new_v4().to_string();

    // Custom profiles get a position one past the current max so they
    // appear at the bottom of the list.
    let next_pos: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM profiles",
            [],
            |r| r.get(0),
        )?;

    conn.execute(
        "INSERT INTO profiles (id, name, system_prompt, is_builtin, position, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 0, ?4, ?5, ?5)",
        params![id, name, system_prompt, next_pos, now],
    )?;

    Ok(Profile {
        id,
        name,
        system_prompt,
        is_builtin: false,
        position: next_pos,
        created_at: now,
        updated_at: now,
    })
}

/// Partial update — both fields are optional so the frontend can patch
/// just one. Returns an error if the profile doesn't exist.
pub fn update(
    conn: &Connection,
    id: &str,
    name: Option<String>,
    system_prompt: Option<String>,
) -> Result<Profile> {
    let existing = get(conn, id)?
        .ok_or_else(|| AppError::Database(format!("profile {id} not found")))?;

    let new_name = name.unwrap_or(existing.name);
    let new_prompt = system_prompt.unwrap_or(existing.system_prompt);
    let now = chrono::Utc::now().timestamp_millis();

    let changed = conn.execute(
        "UPDATE profiles SET name = ?1, system_prompt = ?2, updated_at = ?3 WHERE id = ?4",
        params![new_name, new_prompt, now, id],
    )?;
    if changed == 0 {
        return Err(AppError::Database(format!("profile {id} not found")));
    }

    Ok(Profile {
        id: existing.id,
        name: new_name,
        system_prompt: new_prompt,
        is_builtin: existing.is_builtin,
        position: existing.position,
        created_at: existing.created_at,
        updated_at: now,
    })
}

/// Delete a profile. Refuses with a clear error if it's a builtin row.
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let is_builtin: Option<i64> = conn
        .query_row(
            "SELECT is_builtin FROM profiles WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional()?;
    match is_builtin {
        None => Err(AppError::Database(format!("profile {id} not found"))),
        Some(1) => Err(AppError::Other(
            "cannot delete a builtin profile".to_string(),
        )),
        Some(_) => {
            conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])?;
            Ok(())
        }
    }
}

/// Shared row-mapping used by `list` and `get` so they stay in sync.
fn row_to_profile(row: &Row<'_>) -> rusqlite::Result<Profile> {
    let is_builtin_i: i64 = row.get("is_builtin")?;
    Ok(Profile {
        id: row.get("id")?,
        name: row.get("name")?,
        system_prompt: row.get("system_prompt")?,
        is_builtin: is_builtin_i != 0,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}
