use super::types::*;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;

pub fn parse_input<T: for<'de> Deserialize<'de>>(input: Option<Value>) -> Result<T, String> {
    let value = input.unwrap_or_else(|| json!({}));
    serde_json::from_value(value).map_err(|error| format!("Invalid input: {error}"))
}

pub fn parse_media_only_input(input: Option<Value>) -> Result<String, String> {
    let value = input.unwrap_or_else(|| json!({}));
    value
        .get("mediaId")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| "mediaId is required".to_string())
}

pub fn collect_json_rows<T>(
    rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>>,
) -> Result<Value, String>
where
    T: Into<Value>,
{
    let mut values = Vec::new();
    for row in rows {
        values.push(
            row.map(Into::into)
                .map_err(|error| format!("Collecting query rows failed: {error}"))?,
        );
    }
    Ok(Value::Array(values))
}

pub fn collect_typed_rows<T>(
    rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>>,
) -> Result<Vec<T>, String> {
    let mut values = Vec::new();
    for row in rows {
        values.push(row.map_err(|error| format!("Collecting query rows failed: {error}"))?);
    }
    Ok(values)
}

pub fn media_summary_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<MediaSummary> {
    Ok(MediaSummary {
        id: row.get(0)?,
        media_source_id: row.get(1)?,
        file_path: row.get(2)?,
        file_name: row.get(3)?,
        media_type: row.get(4)?,
        width: row.get(5)?,
        height: row.get(6)?,
        file_size: row.get(7)?,
        description: row.get(8)?,
        created_at: row.get(9)?,
        modified_at: row.get(10)?,
        indexed_at: row.get(11)?,
        status: row.get(12)?,
    })
}

pub fn media_summary_to_value(summary: &MediaSummary) -> Value {
    json!({
        "id": summary.id,
        "mediaSourceId": summary.media_source_id,
        "filePath": summary.file_path,
        "fileName": summary.file_name,
        "mediaType": summary.media_type,
        "width": summary.width,
        "height": summary.height,
        "fileSize": summary.file_size,
        "description": summary.description,
        "createdAt": summary.created_at,
        "modifiedAt": summary.modified_at,
        "indexedAt": summary.indexed_at,
        "status": summary.status,
    })
}

pub fn preset_row_to_value(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    let value_json: String = row.get(2)?;
    Ok(json!({
        "id": row.get::<_, i64>(0)?,
        "name": row.get::<_, String>(1)?,
        "value": serde_json::from_str::<Value>(&value_json).unwrap_or_else(|_| json!({"type":"group","operator":"and","children":[]})),
        "sort": row.get::<_, Option<String>>(3)?,
        "order": row.get::<_, Option<String>>(4)?,
        "mode": row.get::<_, Option<String>>(5)?,
        "createdAt": row.get::<_, String>(6)?,
    }))
}

pub fn build_allowed_extensions(config: &SupportedExtensionsConfig) -> HashMap<String, String> {
    let mut allowed = HashMap::new();
    for ext in &config.image {
        allowed.insert(ext.to_ascii_lowercase(), "image".to_string());
    }
    for ext in &config.video {
        allowed.insert(ext.to_ascii_lowercase(), "video".to_string());
    }
    for ext in &config.audio {
        allowed.insert(ext.to_ascii_lowercase(), "audio".to_string());
    }
    allowed
}

pub fn media_type_from_extension(
    allowed: &HashMap<String, String>,
    extension: &str,
) -> Option<String> {
    allowed.get(extension).cloned()
}

pub fn normalize_relative_path(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn parse_json_text(value: Option<String>) -> Value {
    value
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or(Value::Null)
}

pub fn merge_json(target: &mut Value, patch: &Value) {
    match (target, patch) {
        (Value::Object(target_map), Value::Object(patch_map)) => {
            for (key, value) in patch_map {
                match target_map.get_mut(key) {
                    Some(existing) => merge_json(existing, value),
                    None => {
                        target_map.insert(key.clone(), value.clone());
                    }
                }
            }
        }
        (target, patch) => {
            *target = patch.clone();
        }
    }
}
