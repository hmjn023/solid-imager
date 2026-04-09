use crate::backend::helpers::*;
use crate::backend::types::*;
use serde_json::{json, Value};
use std::fs;

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
        let text = fs::read_to_string(&self.config_path)
            .map_err(|error| format!("Reading config file failed: {error}"))?;
        serde_json::from_str(&text).map_err(|error| format!("Parsing config file failed: {error}"))
    }

    pub fn write_config(&self, config: &AppConfig) -> Result<(), String> {
        let text = serde_json::to_string_pretty(config)
            .map_err(|error| format!("Serializing config failed: {error}"))?;
        fs::write(&self.config_path, text)
            .map_err(|error| format!("Writing config file failed: {error}"))
    }
}
