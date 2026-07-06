//! SQLite database layer.
//!
//! Owns the connection (managed by Tauri as `DbState`), the schema
//! migrations, and the seeding of the 6 builtin profiles. Per-table
//! CRUD lives in sibling modules (`profiles`, `conversations`,
//! `messages`, `captures`) and is consumed by the IPC commands.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::Result;

pub mod captures;
pub mod conversations;
pub mod export;
pub mod messages;
pub mod profiles;
pub mod vault;
pub mod wipe;

/// Managed state handed to Tauri via `app.manage(DbState(...))`.
///
/// A single `Mutex<Connection>` is sufficient for this app's scale — we
/// never hold the lock across `.await` and our transactions are short.
/// Swap to a `r2d2_sqlite::Pool` later if benchmarks show contention.
pub struct DbState(pub Mutex<Connection>);

/// Open (or create) the SQLite database at `path` and enable foreign
/// keys + WAL mode. Foreign keys are required for the
/// `ON DELETE CASCADE / SET NULL` clauses in the schema.
pub fn open(path: &Path) -> Result<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let conn = Connection::open(path)?;
    // FK enforcement is OFF by default in SQLite; turn it on per-connection.
    conn.pragma_update(None, "foreign_keys", "ON")?;
    // WAL gives us better concurrent-read behaviour; safe with a single
    // writer because every command grabs the Mutex anyway.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    Ok(conn)
}

/// Apply all schema migrations. Idempotent — uses `IF NOT EXISTS` so it's
/// safe to call on every startup.
pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA_SQL)?;
    migrate_v2(conn)?;
    migrate_vault(conn)?;
    log::info!("database migrations applied");
    Ok(())
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let sql = format!("PRAGMA table_info({table})");
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<()> {
    if column_exists(conn, table, column)? {
        return Ok(());
    }
    let sql = format!("ALTER TABLE {table} ADD COLUMN {column} {definition}");
    conn.execute(&sql, [])?;
    log::info!("db migration: added {table}.{column}");
    Ok(())
}

/// Profile tone / max_words (Sprint C).
fn migrate_v2(conn: &Connection) -> Result<()> {
    add_column_if_missing(conn, "profiles", "max_words", "INTEGER NOT NULL DEFAULT 120")?;
    add_column_if_missing(conn, "profiles", "tone", "TEXT NOT NULL DEFAULT 'neutral'")?;
    Ok(())
}

fn migrate_vault(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
CREATE TABLE IF NOT EXISTS vault_chunks (
  id          TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  chunk_text  TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vault_source ON vault_chunks(source_path);
"#,
    )?;
    Ok(())
}

/// Seed the 6 builtin profile rows on first launch. The full
/// `system_prompt` text is left empty and is backfilled by the frontend
/// (which owns the prompt content) via `update_profile` IPC on startup.
pub fn seed_builtin_profiles(conn: &Connection) -> Result<()> {
    let count: i64 =
        conn.query_row("SELECT COUNT(*) FROM profiles WHERE is_builtin = 1", [], |r| r.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp_millis();
    let builtins: &[(&str, &str)] = &[
        ("interview", "Interview"),
        ("sales", "Sales"),
        ("meeting", "Meeting"),
        ("presentation", "Presentation"),
        ("negotiation", "Negotiation"),
        ("exam", "Exam"),
    ];

    for (i, (id, name)) in builtins.iter().enumerate() {
        conn.execute(
            "INSERT INTO profiles (id, name, system_prompt, is_builtin, position, created_at, updated_at) \
             VALUES (?1, ?2, ?3, 1, ?4, ?5, ?5)",
            rusqlite::params![id, name, "", i as i32, now],
        )?;
    }

    log::info!("seeded {} builtin profiles", builtins.len());
    Ok(())
}

/// All schema statements in one batch. Adding a new table? Append the
/// `CREATE TABLE / CREATE INDEX` here in the right dependency order
/// (parents before children, since FKs are enforced).
const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  is_builtin    INTEGER NOT NULL DEFAULT 0,
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  profile_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT NOT NULL,
  role             TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content          TEXT NOT NULL,
  audio_transcript TEXT,
  screenshot_id    TEXT,
  model            TEXT,
  tokens_in        INTEGER,
  tokens_out       INTEGER,
  created_at       INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS captures (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK(kind IN ('screen','audio')),
  file_path   TEXT NOT NULL,
  width       INTEGER,
  height      INTEGER,
  duration_ms INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation    ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at     ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
"#;
