use crate::backend::helpers::*;
use crate::backend::types::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use uuid::Uuid;

impl super::LocalBackend {
    pub fn handle_characters_list(&self) -> Result<Value, String> {
        let conn = self.open_connection()?;
        let ids = self.list_entity_ids(&conn, "characters")?;
        let mut items = Vec::with_capacity(ids.len());
        for id in ids {
            if let Some(value) = self.find_character_value(&conn, &id)? {
                items.push(value);
            }
        }
        Ok(Value::Array(items))
    }

    pub fn handle_character_create(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: CharacterMutationInput = parse_input(input)?;
        let name = payload
            .name
            .ok_or_else(|| "Character name is required".to_string())?;
        let conn = self.open_connection()?;
        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        conn.execute(
			"INSERT INTO characters (id, name, description, source, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
			params![id, name, payload.description, "manual", now, now],
		)
		.map_err(|error| format!("Creating character failed: {error}"))?;
        self.replace_character_ips(&conn, &id, payload.ip_ids.unwrap_or_default())?;
        self.find_character_value(&conn, &id)?
            .ok_or_else(|| "Created character could not be loaded".to_string())
    }

    pub fn handle_character_update(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: Value = input.ok_or_else(|| "Missing character update payload".to_string())?;
        let id = payload
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Character id is required".to_string())?;
        let data = payload.get("data").cloned().unwrap_or_else(|| json!({}));
        let conn = self.open_connection()?;
        let mut current = self
            .find_character_value(&conn, id)?
            .ok_or_else(|| format!("Character not found: {id}"))?;
        merge_json(&mut current, &data);
        conn.execute(
            "UPDATE characters SET name = ?1, description = ?2, updated_at = ?3 WHERE id = ?4",
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
        .map_err(|error| format!("Updating character failed: {error}"))?;
        let ip_ids = data
            .get("ipIds")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(ToOwned::to_owned))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_else(|| {
                current
                    .get("ips")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .filter_map(|item| {
                                item.get("id")
                                    .and_then(Value::as_str)
                                    .map(ToOwned::to_owned)
                            })
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default()
            });
        self.replace_character_ips(&conn, id, ip_ids)?;
        self.find_character_value(&conn, id)?
            .ok_or_else(|| "Updated character could not be loaded".to_string())
    }

    pub fn handle_character_delete(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: IdInput = parse_input(input)?;
        let conn = self.open_connection()?;
        conn.execute("DELETE FROM characters WHERE id = ?1", params![payload.id])
            .map_err(|error| format!("Deleting character failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn handle_characters_for_media(&self, input: Option<Value>) -> Result<Value, String> {
        let payload = parse_media_only_input(input)?;
        let conn = self.open_connection()?;
        self.list_characters_for_media_value(&conn, &payload)
    }

    pub fn handle_character_add_to_media(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: MediaAssociationInput = parse_input(input)?;
        let character_id = payload
            .character_id
            .ok_or_else(|| "characterId is required".to_string())?;
        let conn = self.open_connection()?;
        conn.execute(
			"INSERT OR IGNORE INTO media_characters (media_id, character_id, confidence, source) VALUES (?1, ?2, NULL, 'manual')",
			params![payload.media_id, character_id],
		)
		.map_err(|error| format!("Adding character to media failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn handle_character_remove_from_media(
        &self,
        input: Option<Value>,
    ) -> Result<Value, String> {
        let payload: MediaAssociationInput = parse_input(input)?;
        let character_id = payload
            .character_id
            .ok_or_else(|| "characterId is required".to_string())?;
        let conn = self.open_connection()?;
        conn.execute(
            "DELETE FROM media_characters WHERE media_id = ?1 AND character_id = ?2",
            params![payload.media_id, character_id],
        )
        .map_err(|error| format!("Removing character from media failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn find_character_value(
        &self,
        conn: &Connection,
        id: &str,
    ) -> Result<Option<Value>, String> {
        let row = conn
			.query_row(
				"SELECT id, name, description, created_at, updated_at FROM characters WHERE id = ?1",
				params![id],
				|row| {
					Ok((
						row.get::<_, String>(0)?,
						row.get::<_, String>(1)?,
						row.get::<_, Option<String>>(2)?,
						row.get::<_, String>(3)?,
						row.get::<_, String>(4)?,
					))
				},
			)
			.optional()
			.map_err(|error| format!("Looking up character failed: {error}"))?;
        let Some((character_id, name, description, created_at, updated_at)) = row else {
            return Ok(None);
        };
        Ok(Some(json!({
            "id": character_id.clone(),
            "name": name,
            "description": description,
            "ips": self.list_ips_for_character_value(conn, &character_id)?,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })))
    }

    pub fn replace_character_ips(
        &self,
        conn: &Connection,
        character_id: &str,
        ip_ids: Vec<String>,
    ) -> Result<(), String> {
        conn.execute(
            "DELETE FROM character_ips WHERE character_id = ?1",
            params![character_id],
        )
        .map_err(|error| format!("Clearing character IPs failed: {error}"))?;
        for ip_id in ip_ids {
            conn.execute(
                "INSERT OR IGNORE INTO character_ips (character_id, ip_id) VALUES (?1, ?2)",
                params![character_id, ip_id],
            )
            .map_err(|error| format!("Saving character IP failed: {error}"))?;
        }
        Ok(())
    }

    pub fn ensure_character(
        &self,
        conn: &Connection,
        name: &str,
        source: &str,
        ip_ids: &[String],
    ) -> Result<String, String> {
        if let Some(id) = conn
            .query_row(
                "SELECT id FROM characters WHERE name = ?1",
                params![name],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("Looking up character failed: {error}"))?
        {
            for ip_id in ip_ids {
                conn.execute(
                    "INSERT OR IGNORE INTO character_ips (character_id, ip_id) VALUES (?1, ?2)",
                    params![id.clone(), ip_id],
                )
                .map_err(|error| format!("Linking character to IP failed: {error}"))?;
            }
            return Ok(id);
        }
        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        conn.execute(
			"INSERT INTO characters (id, name, description, source, created_at, updated_at) VALUES (?1, ?2, NULL, ?3, ?4, ?5)",
			params![id, name, source, now, now],
		)
		.map_err(|error| format!("Creating character failed: {error}"))?;
        for ip_id in ip_ids {
            conn.execute(
                "INSERT OR IGNORE INTO character_ips (character_id, ip_id) VALUES (?1, ?2)",
                params![id.clone(), ip_id],
            )
            .map_err(|error| format!("Linking character to IP failed: {error}"))?;
        }
        Ok(id)
    }
}
