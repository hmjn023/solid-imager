use crate::backend::helpers::*;
use crate::backend::types::*;
use rusqlite::params;
use serde_json::{json, Value};

impl super::LocalBackend {
    pub fn handle_config_update(&self, input: Option<Value>) -> Result<Value, String> {
        let patch = input.unwrap_or_else(|| json!({}));
        let mut current = serde_json::to_value(self.read_config()?)
            .map_err(|error| format!("Serializing config failed: {error}"))?;
        merge_json(&mut current, &patch);
        let merged: AppConfig = serde_json::from_value(current)
            .map_err(|error| format!("Validating config failed: {error}"))?;
        self.write_config(&merged)?;
        serde_json::to_value(merged).map_err(|error| format!("Serializing config failed: {error}"))
    }

    pub fn read_config(&self) -> Result<AppConfig, String> {
        let conn = self.open_connection()?;
        let text: String = conn
            .query_row(
                "SELECT value_json FROM app_config WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .map_err(|error| format!("Reading config from database failed: {error}"))?;
        serde_json::from_str(&text)
            .map_err(|error| format!("Parsing stored config failed: {error}"))
    }

    pub fn write_config(&self, config: &AppConfig) -> Result<(), String> {
        let conn = self.open_connection()?;
        let text = serde_json::to_string_pretty(config)
            .map_err(|error| format!("Serializing config failed: {error}"))?;
        conn.execute(
            "INSERT INTO app_config (id, value_json, updated_at) VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
            params![text, now_iso()],
        )
        .map_err(|error| format!("Writing config to database failed: {error}"))?;
        Ok(())
    }
}
