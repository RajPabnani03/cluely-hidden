//! `profiles` table CRUD.

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
    pub max_words: i32,
    pub tone: String,
    pub created_at: i64,
    pub updated_at: i64,
}

const PROFILE_SELECT: &str =
    "SELECT id, name, system_prompt, is_builtin, position, max_words, tone, created_at, updated_at \
     FROM profiles";

pub fn list(conn: &Connection) -> Result<Vec<Profile>> {
    let mut stmt = conn.prepare(&format!("{PROFILE_SELECT} ORDER BY position ASC, created_at ASC"))?;
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
            &format!("{PROFILE_SELECT} WHERE id = ?1"),
            params![id],
            row_to_profile,
        )
        .optional()?;
    Ok(p)
}

pub fn create(conn: &Connection, name: String, system_prompt: String) -> Result<Profile> {
    let now = chrono::Utc::now().timestamp_millis();
    let id = Uuid::new_v4().to_string();

    let next_pos: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM profiles",
            [],
            |r| r.get(0),
        )?;

    conn.execute(
        "INSERT INTO profiles (id, name, system_prompt, is_builtin, position, max_words, tone, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 0, ?4, 120, 'neutral', ?5, ?5)",
        params![id, name, system_prompt, next_pos, now],
    )?;

    Ok(Profile {
        id,
        name,
        system_prompt,
        is_builtin: false,
        position: next_pos,
        max_words: 120,
        tone: "neutral".to_string(),
        created_at: now,
        updated_at: now,
    })
}

pub fn update(
    conn: &Connection,
    id: &str,
    name: Option<String>,
    system_prompt: Option<String>,
    max_words: Option<i32>,
    tone: Option<String>,
) -> Result<Profile> {
    let existing = get(conn, id)?
        .ok_or_else(|| AppError::Database(format!("profile {id} not found")))?;

    let new_name = name.unwrap_or(existing.name);
    let new_prompt = system_prompt.unwrap_or(existing.system_prompt);
    let new_max = max_words.unwrap_or(existing.max_words).clamp(40, 400);
    let new_tone = tone.unwrap_or(existing.tone);
    let now = chrono::Utc::now().timestamp_millis();

    let changed = conn.execute(
        "UPDATE profiles SET name = ?1, system_prompt = ?2, max_words = ?3, tone = ?4, updated_at = ?5 WHERE id = ?6",
        params![new_name, new_prompt, new_max, new_tone, now, id],
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
        max_words: new_max,
        tone: new_tone,
        created_at: existing.created_at,
        updated_at: now,
    })
}

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

fn row_to_profile(row: &Row<'_>) -> rusqlite::Result<Profile> {
    let is_builtin_i: i64 = row.get("is_builtin")?;
    Ok(Profile {
        id: row.get("id")?,
        name: row.get("name")?,
        system_prompt: row.get("system_prompt")?,
        is_builtin: is_builtin_i != 0,
        position: row.get("position")?,
        max_words: row.get::<_, i32>("max_words").unwrap_or(120),
        tone: row.get::<_, String>("tone").unwrap_or_else(|_| "neutral".to_string()),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}