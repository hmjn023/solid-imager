use crate::backend::helpers::*;
use crate::backend::types::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use uuid::Uuid;

impl super::LocalBackend {
    pub fn handle_ips_list(&self) -> Result<Value, String> {
        let conn = self.open_connection()?;
        let mut stmt = conn
			.prepare("SELECT id, name, description, source, created_at, updated_at FROM ips ORDER BY name ASC")
			.map_err(|error| format!("Preparing IP list failed: {error}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "source": row.get::<_, String>(3)?,
                    "createdAt": row.get::<_, String>(4)?,
                    "updatedAt": row.get::<_, String>(5)?,
                }))
            })
            .map_err(|error| format!("Querying IPs failed: {error}"))?;
        collect_json_rows(rows)
    }

    pub fn handle_ip_create(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: ProjectMutationInput = parse_input(input)?;
        let name = payload
            .name
            .ok_or_else(|| "IP name is required".to_string())?;
        let conn = self.open_connection()?;
        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        conn.execute(
			"INSERT INTO ips (id, name, description, source, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
			params![id, name, payload.description, "manual", now, now],
		)
		.map_err(|error| format!("Creating IP failed: {error}"))?;
        self.find_ip_value(&conn, &id)?
            .ok_or_else(|| "Created IP could not be loaded".to_string())
    }

    pub fn handle_ip_update(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: Value = input.ok_or_else(|| "Missing IP update payload".to_string())?;
        let id = payload
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "IP id is required".to_string())?;
        let data = payload.get("data").cloned().unwrap_or_else(|| json!({}));
        let conn = self.open_connection()?;
        let mut current = self
            .find_ip_value(&conn, id)?
            .ok_or_else(|| format!("IP not found: {id}"))?;
        merge_json(&mut current, &data);
        conn.execute(
            "UPDATE ips SET name = ?1, description = ?2, updated_at = ?3 WHERE id = ?4",
            params![
                current
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
                current.get("description").and_then(Value::as_str),
                now_iso(),
                id,
            ],
        )
        .map_err(|error| format!("Updating IP failed: {error}"))?;
        self.find_ip_value(&conn, id)?
            .ok_or_else(|| "Updated IP could not be loaded".to_string())
    }

    pub fn handle_ip_delete(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: IdInput = parse_input(input)?;
        let conn = self.open_connection()?;
        conn.execute("DELETE FROM ips WHERE id = ?1", params![payload.id])
            .map_err(|error| format!("Deleting IP failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn handle_ips_for_media(&self, input: Option<Value>) -> Result<Value, String> {
        let payload = parse_media_only_input(input)?;
        let conn = self.open_connection()?;
        self.list_ips_for_media_value(&conn, &payload)
    }

    pub fn handle_ip_add_to_media(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: MediaAssociationInput = parse_input(input)?;
        let ip_id = payload
            .ip_id
            .ok_or_else(|| "ipId is required".to_string())?;
        let conn = self.open_connection()?;
        conn.execute(
			"INSERT OR IGNORE INTO media_ips (media_id, ip_id, confidence, source) VALUES (?1, ?2, NULL, 'manual')",
			params![payload.media_id, ip_id],
		)
		.map_err(|error| format!("Adding IP to media failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn handle_ip_remove_from_media(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: MediaAssociationInput = parse_input(input)?;
        let ip_id = payload
            .ip_id
            .ok_or_else(|| "ipId is required".to_string())?;
        let conn = self.open_connection()?;
        conn.execute(
            "DELETE FROM media_ips WHERE media_id = ?1 AND ip_id = ?2",
            params![payload.media_id, ip_id],
        )
        .map_err(|error| format!("Removing IP from media failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn list_ips_for_character_value(
        &self,
        conn: &Connection,
        character_id: &str,
    ) -> Result<Value, String> {
        let mut stmt = conn
			.prepare(
				"SELECT i.id, i.name FROM ips i INNER JOIN character_ips ci ON ci.ip_id = i.id WHERE ci.character_id = ?1 ORDER BY i.name ASC",
			)
			.map_err(|error| format!("Preparing character IP query failed: {error}"))?;
        let rows = stmt
            .query_map(params![character_id], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                }))
            })
            .map_err(|error| format!("Querying character IPs failed: {error}"))?;
        collect_json_rows(rows)
    }

    pub fn find_ip_value(&self, conn: &Connection, id: &str) -> Result<Option<Value>, String> {
        conn.query_row(
            "SELECT id, name, description, source, created_at, updated_at FROM ips WHERE id = ?1",
            params![id],
            |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "source": row.get::<_, String>(3)?,
                    "createdAt": row.get::<_, String>(4)?,
                    "updatedAt": row.get::<_, String>(5)?,
                }))
            },
        )
        .optional()
        .map_err(|error| format!("Looking up IP failed: {error}"))
    }

    pub fn ensure_ip(
        &self,
        conn: &Connection,
        name: &str,
        description: Option<&str>,
        source: &str,
    ) -> Result<String, String> {
        if let Some(id) = conn
            .query_row("SELECT id FROM ips WHERE name = ?1", params![name], |row| {
                row.get::<_, String>(0)
            })
            .optional()
            .map_err(|error| format!("Looking up IP failed: {error}"))?
        {
            return Ok(id);
        }
        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        conn.execute(
			"INSERT INTO ips (id, name, description, source, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
			params![id, name, description, source, now, now],
		)
		.map_err(|error| format!("Creating IP failed: {error}"))?;
        Ok(id)
    }
}
