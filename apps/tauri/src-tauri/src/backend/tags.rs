use crate::backend::helpers::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use uuid::Uuid;

impl super::LocalBackend {
    pub fn handle_tags_list(&self) -> Result<Value, String> {
        let conn = self.open_connection()?;
        let mut stmt = conn
			.prepare("SELECT id, name, description, attribute, color, source, author_id, created_at, updated_at FROM tags ORDER BY name ASC")
			.map_err(|error| format!("Preparing tags list failed: {error}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "attribute": row.get::<_, Option<String>>(3)?,
                    "color": row.get::<_, Option<String>>(4)?,
                    "source": row.get::<_, String>(5)?,
                    "authorId": row.get::<_, Option<String>>(6)?,
                    "createdAt": row.get::<_, String>(7)?,
                    "updatedAt": row.get::<_, String>(8)?,
                }))
            })
            .map_err(|error| format!("Querying tags failed: {error}"))?;
        collect_json_rows(rows)
    }

    pub fn ensure_tag(
        &self,
        conn: &Connection,
        name: &str,
        source: &str,
    ) -> Result<String, String> {
        if let Some(id) = conn
            .query_row(
                "SELECT id FROM tags WHERE name = ?1",
                params![name],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("Looking up tag failed: {error}"))?
        {
            return Ok(id);
        }
        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        conn.execute(
			"INSERT INTO tags (id, name, description, attribute, color, source, author_id, created_at, updated_at) VALUES (?1, ?2, NULL, NULL, NULL, ?3, NULL, ?4, ?5)",
			params![id, name, source, now, now],
		)
		.map_err(|error| format!("Creating tag failed: {error}"))?;
        Ok(id)
    }
}
