//! Export a conversation as Markdown for sharing / archival.

use rusqlite::{params, Connection};

use crate::error::Result;

pub fn export_markdown(conn: &Connection, conversation_id: &str) -> Result<String> {
    let title: Option<String> = conn
        .query_row(
            "SELECT title FROM conversations WHERE id = ?1",
            params![conversation_id],
            |r| r.get(0),
        )
        .ok();

    let mut stmt = conn.prepare(
        "SELECT role, content, created_at FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![conversation_id], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i64>(2)?,
        ))
    })?;

    let mut out = String::new();
    out.push_str(&format!(
        "# {}\n\n",
        title.unwrap_or_else(|| "Conversation".to_string())
    ));
    out.push_str(&format!("_Exported from Cluely Hidden — conversation `{conversation_id}`_\n\n---\n\n"));

    for row in rows {
        let (role, content, ts) = row?;
        let heading = match role.as_str() {
            "user" => "You",
            "assistant" => "Assistant",
            _ => "System",
        };
        out.push_str(&format!("### {heading} ({ts})\n\n{content}\n\n"));
    }

    Ok(out)
}