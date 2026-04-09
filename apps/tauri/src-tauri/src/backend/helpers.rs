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

pub fn evaluate_node(node: &SearchNode, item: &MediaContext) -> bool {
    let result = match node {
        SearchNode::Criterion {
            target,
            operator,
            value,
            negate,
        } => {
            let operator = operator.as_deref().unwrap_or("equals");
            let matches = evaluate_criterion(target, operator, value.as_ref(), item);
            if negate.unwrap_or(false) {
                !matches
            } else {
                matches
            }
        }
        SearchNode::Group {
            operator,
            children,
            negate,
        } => {
            let matches = if operator == "or" {
                children.iter().any(|child| evaluate_node(child, item))
            } else {
                children.iter().all(|child| evaluate_node(child, item))
            };
            if negate.unwrap_or(false) {
                !matches
            } else {
                matches
            }
        }
    };
    result
}

pub fn evaluate_criterion(
    target: &str,
    operator: &str,
    value: Option<&Value>,
    item: &MediaContext,
) -> bool {
    match target {
        "width" => compare_number(item.summary.width as f64, operator, value),
        "height" => compare_number(item.summary.height as f64, operator, value),
        "fileSize" => compare_number(item.summary.file_size.unwrap_or(0) as f64, operator, value),
        "createdAt" => compare_string(&item.summary.created_at, operator, value),
        "fileName" => compare_string(&item.summary.file_name, operator, value),
        "filePath" => compare_string(&item.summary.file_path, operator, value),
        "description" => {
            compare_optional_string(item.summary.description.as_deref(), operator, value)
        }
        "mediaType" => compare_string(&item.summary.media_type, operator, value),
        "tag" => compare_list(&item.tags, operator, value),
        "author" => compare_list(&item.authors, operator, value),
        "project" => compare_list(&item.projects, operator, value),
        "ip" => compare_list(&item.ips, operator, value),
        "character" => compare_list(&item.characters, operator, value),
        "keyword" => {
            let haystack = [
                item.summary.file_name.as_str(),
                item.summary.file_path.as_str(),
                item.summary.description.as_deref().unwrap_or_default(),
                item.prompt.as_deref().unwrap_or_default(),
            ]
            .join(" ")
            .to_ascii_lowercase();
            match value.and_then(Value::as_str) {
                Some(needle) => haystack.contains(&needle.to_ascii_lowercase()),
                None => false,
            }
        }
        "folder" => {
            let folder = item
                .summary
                .file_path
                .rsplit_once('/')
                .map(|(prefix, _)| prefix.to_string())
                .unwrap_or_default();
            compare_string(&folder, operator, value)
        }
        "aiGenerated" => compare_bool(item.ai_generated, operator, value),
        "favorite" => compare_bool(false, operator, value),
        "rating" | "viewCount" => compare_number(0.0, operator, value),
        _ => false,
    }
}

pub fn compare_string(value: &str, operator: &str, input: Option<&Value>) -> bool {
    let lower = value.to_ascii_lowercase();
    match operator {
        "contains" => input
            .and_then(Value::as_str)
            .map(|needle| lower.contains(&needle.to_ascii_lowercase()))
            .unwrap_or(false),
        "startsWith" => input
            .and_then(Value::as_str)
            .map(|needle| lower.starts_with(&needle.to_ascii_lowercase()))
            .unwrap_or(false),
        "endsWith" => input
            .and_then(Value::as_str)
            .map(|needle| lower.ends_with(&needle.to_ascii_lowercase()))
            .unwrap_or(false),
        "isEmpty" => value.is_empty(),
        "isNotEmpty" => !value.is_empty(),
        "in" => input
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .any(|candidate| candidate.eq_ignore_ascii_case(value))
            })
            .unwrap_or(false),
        "notIn" => input
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .all(|candidate| !candidate.eq_ignore_ascii_case(value))
            })
            .unwrap_or(false),
        _ => input
            .and_then(Value::as_str)
            .map(|candidate| candidate.eq_ignore_ascii_case(value))
            .unwrap_or(false),
    }
}

pub fn compare_optional_string(value: Option<&str>, operator: &str, input: Option<&Value>) -> bool {
    match value {
        Some(value) => compare_string(value, operator, input),
        None => matches!(operator, "isEmpty"),
    }
}

pub fn compare_list(values: &[String], operator: &str, input: Option<&Value>) -> bool {
    match operator {
        "isEmpty" => values.is_empty(),
        "isNotEmpty" => !values.is_empty(),
        "contains" => input
            .and_then(Value::as_str)
            .map(|needle| {
                let needle = needle.to_ascii_lowercase();
                values
                    .iter()
                    .any(|value| value.to_ascii_lowercase().contains(&needle))
            })
            .unwrap_or(false),
        "in" => input
            .and_then(Value::as_array)
            .map(|items| {
                items.iter().filter_map(Value::as_str).any(|candidate| {
                    values
                        .iter()
                        .any(|value| value.eq_ignore_ascii_case(candidate))
                })
            })
            .unwrap_or(false),
        "notIn" => input
            .and_then(Value::as_array)
            .map(|items| {
                items.iter().filter_map(Value::as_str).all(|candidate| {
                    values
                        .iter()
                        .all(|value| !value.eq_ignore_ascii_case(candidate))
                })
            })
            .unwrap_or(false),
        _ => input
            .and_then(Value::as_str)
            .map(|candidate| {
                values
                    .iter()
                    .any(|value| value.eq_ignore_ascii_case(candidate))
            })
            .unwrap_or(false),
    }
}

pub fn compare_bool(value: bool, operator: &str, input: Option<&Value>) -> bool {
    match operator {
        "isEmpty" => false,
        "isNotEmpty" => true,
        _ => input
            .and_then(Value::as_bool)
            .map(|candidate| candidate == value)
            .unwrap_or(false),
    }
}

pub fn compare_number(value: f64, operator: &str, input: Option<&Value>) -> bool {
    let candidate = input.and_then(|value| value.as_f64());
    match operator {
        "gt" => candidate.map(|other| value > other).unwrap_or(false),
        "gte" => candidate.map(|other| value >= other).unwrap_or(false),
        "lt" => candidate.map(|other| value < other).unwrap_or(false),
        "lte" => candidate.map(|other| value <= other).unwrap_or(false),
        "isEmpty" => false,
        "isNotEmpty" => true,
        _ => candidate
            .map(|other| (value - other).abs() < f64::EPSILON)
            .unwrap_or(false),
    }
}

pub fn sort_media_contexts(items: &mut [MediaContext], sort: &str, order: &str) {
    items.sort_by(|left, right| {
        let ordering = match sort {
            "name" => left.summary.file_name.cmp(&right.summary.file_name),
            "size" => left
                .summary
                .file_size
                .unwrap_or(0)
                .cmp(&right.summary.file_size.unwrap_or(0)),
            _ => left.summary.modified_at.cmp(&right.summary.modified_at),
        };
        if order == "asc" {
            ordering
        } else {
            ordering.reverse()
        }
    });
}
