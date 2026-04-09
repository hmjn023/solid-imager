use crate::backend::helpers::*;
use crate::backend::types::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};

impl super::LocalBackend {
    pub fn handle_presets_list(&self) -> Result<Value, String> {
        let conn = self.open_connection()?;
        let mut stmt = conn
			.prepare("SELECT id, name, value_json, sort, order_value, mode, created_at FROM presets ORDER BY id ASC")
			.map_err(|error| format!("Preparing presets list failed: {error}"))?;
        let rows = stmt
            .query_map([], preset_row_to_value)
            .map_err(|error| format!("Querying presets failed: {error}"))?;
        collect_json_rows(rows)
    }

    pub fn handle_presets_get(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: PresetIdInput = parse_input(input)?;
        let conn = self.open_connection()?;
        self.find_preset_value(&conn, payload.id)?
            .ok_or_else(|| format!("Preset not found: {}", payload.id))
    }

    pub fn handle_presets_get_by_name(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: NameInput = parse_input(input)?;
        let conn = self.open_connection()?;
        let mut stmt = conn
			.prepare("SELECT id, name, value_json, sort, order_value, mode, created_at FROM presets WHERE name = ?1")
			.map_err(|error| format!("Preparing preset lookup failed: {error}"))?;
        stmt.query_row(params![payload.name], preset_row_to_value)
            .optional()
            .map_err(|error| format!("Looking up preset failed: {error}"))?
            .ok_or_else(|| format!("Preset not found: {}", payload.name))
    }

    pub fn handle_presets_create(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: PresetCreateInput = parse_input(input)?;
        let conn = self.open_connection()?;
        let now = now_iso();
        conn.execute(
			"INSERT INTO presets (name, value_json, sort, order_value, mode, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
			params![
				payload.name,
				payload.value.to_string(),
				payload.sort,
				payload.order,
				payload.mode,
				now,
			],
		)
		.map_err(|error| format!("Creating preset failed: {error}"))?;
        let id = conn.last_insert_rowid();
        self.find_preset_value(&conn, id)?
            .ok_or_else(|| "Created preset could not be loaded".to_string())
    }

    pub fn handle_presets_update(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: PresetUpdateInput = parse_input(input)?;
        let conn = self.open_connection()?;
        let mut current = self
            .find_preset_value(&conn, payload.id)?
            .ok_or_else(|| format!("Preset not found: {}", payload.id))?;
        merge_json(&mut current, &payload.data);
        conn.execute(
			"UPDATE presets SET name = ?1, value_json = ?2, sort = ?3, order_value = ?4, mode = ?5 WHERE id = ?6",
			params![
				current.get("name").and_then(Value::as_str).unwrap_or_default(),
				current.get("value").cloned().unwrap_or_else(|| json!({})).to_string(),
				current.get("sort").and_then(Value::as_str),
				current.get("order").and_then(Value::as_str),
				current.get("mode").and_then(Value::as_str),
				payload.id,
			],
		)
		.map_err(|error| format!("Updating preset failed: {error}"))?;
        self.find_preset_value(&conn, payload.id)?
            .ok_or_else(|| "Updated preset could not be loaded".to_string())
    }

    pub fn handle_presets_delete(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: PresetIdInput = parse_input(input)?;
        let conn = self.open_connection()?;
        conn.execute("DELETE FROM presets WHERE id = ?1", params![payload.id])
            .map_err(|error| format!("Deleting preset failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn find_preset_value(&self, conn: &Connection, id: i64) -> Result<Option<Value>, String> {
        let mut stmt = conn
			.prepare("SELECT id, name, value_json, sort, order_value, mode, created_at FROM presets WHERE id = ?1")
			.map_err(|error| format!("Preparing preset lookup failed: {error}"))?;
        stmt.query_row(params![id], preset_row_to_value)
            .optional()
            .map_err(|error| format!("Looking up preset failed: {error}"))
    }
}
