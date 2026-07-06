//! Wipe local SQLite rows and on-disk capture files (Sprint D emergency erase data).

use std::fs;
use std::path::Path;

use rusqlite::Connection;

use crate::config;
use crate::error::Result;

pub fn wipe_local_data(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM captures;
DELETE FROM vault_chunks;
"#,
    )?;

    let captures_dir = config::data_dir().join("captures");
    remove_dir_contents(&captures_dir)?;

    log::warn!("local data wipe complete");
    Ok(())
}

fn remove_dir_contents(dir: &Path) -> Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            fs::remove_dir_all(&path)?;
        } else {
            fs::remove_file(&path)?;
        }
    }
    Ok(())
}