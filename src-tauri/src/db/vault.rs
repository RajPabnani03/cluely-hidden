//! Local RAG vault — index plain-text files from a folder (Sprint E stub).

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::error::Result;

const CHUNK_CHARS: usize = 1200;
const MAX_DEPTH: usize = 16;
const MAX_ENTRIES: usize = 20_000;
const MAX_FILES: usize = 5_000;
const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_CHUNKS: usize = 50_000;

/// A chunk of text read from a vault file, ready to be inserted.
#[derive(Debug, Clone)]
pub struct VaultChunk {
    pub source_path: String,
    pub chunk_text: String,
}

/// Walk `folder` and chunk its text files. Does not touch the database, so
/// callers can run it without holding the DB lock.
pub fn collect_chunks(folder: &Path) -> Result<Vec<VaultChunk>> {
    if !folder.is_dir() {
        return Err(crate::error::AppError::Other(format!(
            "vault folder not found: {}",
            folder.display()
        )));
    }

    let mut chunks = Vec::new();
    'files: for path in walkdir_lite(folder)? {
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !matches!(ext.as_str(), "md" | "txt" | "markdown") {
            continue;
        }
        let text = match read_capped(&path) {
            Some(t) => t,
            None => continue,
        };
        let source = path.display().to_string();
        for chunk in chunk_text(&text) {
            if chunks.len() >= MAX_CHUNKS {
                break 'files;
            }
            chunks.push(VaultChunk {
                source_path: source.clone(),
                chunk_text: chunk,
            });
        }
    }
    Ok(chunks)
}

/// Atomically replace the vault contents with `chunks`.
pub fn replace_chunks(conn: &mut Connection, chunks: &[VaultChunk]) -> Result<usize> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM vault_chunks", [])?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO vault_chunks (id, source_path, chunk_text, created_at) VALUES (?1, ?2, ?3, ?4)",
        )?;
        let now = chrono::Utc::now().timestamp_millis();
        for c in chunks {
            let id = Uuid::new_v4().to_string();
            stmt.execute(params![id, c.source_path, c.chunk_text, now])?;
        }
    }
    tx.commit()?;
    Ok(chunks.len())
}

/// Read a regular file as UTF-8, skipping it if larger than `MAX_FILE_BYTES`.
fn read_capped(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let mut buf = Vec::new();
    file.take(MAX_FILE_BYTES + 1).read_to_end(&mut buf).ok()?;
    if buf.len() as u64 > MAX_FILE_BYTES {
        return None;
    }
    String::from_utf8(buf).ok()
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

/// List regular files under `root`. Symlinks are never followed, and the walk
/// is bounded by depth, number of entries visited, and number of files returned.
fn walkdir_lite(root: &Path) -> Result<Vec<PathBuf>> {
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    let mut files = Vec::new();
    let mut seen = 0usize;
    while let Some((dir, depth)) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            seen += 1;
            if seen > MAX_ENTRIES {
                return Ok(files);
            }
            let ft = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };
            if ft.is_dir() {
                if depth < MAX_DEPTH {
                    stack.push((entry.path(), depth + 1));
                }
            } else if ft.is_file() {
                files.push(entry.path());
                if files.len() >= MAX_FILES {
                    return Ok(files);
                }
            }
        }
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("vault-test-{name}-{}", Uuid::new_v4()));
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[cfg(unix)]
    #[test]
    fn walk_does_not_follow_symlink_loops() {
        let root = temp_dir("loop");
        let sub = root.join("a");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("note.md"), "hello").unwrap();
        std::os::unix::fs::symlink(&root, sub.join("loop")).unwrap();
        std::os::unix::fs::symlink(sub.join("note.md"), root.join("link.md")).unwrap();

        let files = walkdir_lite(&root).unwrap();
        assert_eq!(files, vec![sub.join("note.md")]);
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn walk_is_depth_bounded() {
        let root = temp_dir("depth");
        let mut d = root.clone();
        for _ in 0..(MAX_DEPTH + 3) {
            d = d.join("d");
        }
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("deep.md"), "deep").unwrap();
        fs::write(root.join("top.md"), "top").unwrap();

        let files = walkdir_lite(&root).unwrap();
        assert_eq!(files, vec![root.join("top.md")]);
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn oversized_files_are_skipped() {
        let root = temp_dir("size");
        let big = root.join("big.md");
        fs::write(&big, vec![b'a'; (MAX_FILE_BYTES + 1) as usize]).unwrap();
        fs::write(root.join("small.md"), "small").unwrap();

        let chunks = collect_chunks(&root).unwrap();
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].chunk_text, "small");
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn replace_chunks_swaps_contents() {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        let chunk = |t: &str| VaultChunk {
            source_path: "x.md".into(),
            chunk_text: t.into(),
        };
        replace_chunks(&mut conn, &[chunk("old"), chunk("old2")]).unwrap();
        replace_chunks(&mut conn, &[chunk("new")]).unwrap();
        let hits = query(&conn, "", 20).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].chunk_text, "new");
    }
}
