//! Local RAG vault — index plain-text files from a folder (Sprint E stub).

use std::fs;
use std::path::Path;

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::error::Result;

const CHUNK_CHARS: usize = 1200;

pub fn index_folder(conn: &Connection, folder: &Path) -> Result<usize> {
    if !folder.is_dir() {
        return Err(crate::error::AppError::Other(format!(
            "vault folder not found: {}",
            folder.display()
        )));
    }

    conn.execute("DELETE FROM vault_chunks", [])?;
    let mut count = 0usize;

    for path in walkdir_lite(folder)? {
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !matches!(ext.as_str(), "md" | "txt" | "markdown") {
            continue;
        }
        let text = match fs::read_to_string(&path) {
            Ok(t) => t,
            Err(_) => continue,
        };
        let source = path.display().to_string();
        for chunk in chunk_text(&text) {
            let id = Uuid::new_v4().to_string();
            let now = chrono::Utc::now().timestamp_millis();
            conn.execute(
                "INSERT INTO vault_chunks (id, source_path, chunk_text, created_at) VALUES (?1, ?2, ?3, ?4)",
                params![id, source, chunk, now],
            )?;
            count += 1;
        }
    }

    Ok(count)
}

pub fn query(conn: &Connection, q: &str, limit: usize) -> Result<Vec<VaultHit>> {
    let pattern = format!("%{}%", q.trim());
    let lim = limit.min(20) as i64;
    let mut stmt = conn.prepare(
        "SELECT source_path, chunk_text FROM vault_chunks WHERE chunk_text LIKE ?1 LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![pattern, lim], |r| {
        Ok(VaultHit {
            source_path: r.get(0)?,
            chunk_text: r.get(1)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultHit {
    pub source_path: String,
    pub chunk_text: String,
}

fn chunk_text(s: &str) -> Vec<String> {
    let t = s.trim();
    if t.is_empty() {
        return vec![];
    }
    let mut out = Vec::new();
    let chars: Vec<char> = t.chars().collect();
    let mut start = 0;
    while start < chars.len() {
        let end = (start + CHUNK_CHARS).min(chars.len());
        let chunk: String = chars[start..end].iter().collect();
        out.push(chunk);
        if end >= chars.len() {
            break;
        }
        start = end;
    }
    out
}

fn walkdir_lite(root: &Path) -> Result<Vec<std::path::PathBuf>> {
    let mut stack = vec![root.to_path_buf()];
    let mut files = Vec::new();
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else {
                files.push(path);
            }
        }
    }
    Ok(files)
}