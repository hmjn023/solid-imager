use crate::backend::helpers::*;
use crate::backend::types::*;
use crate::commands::utils::{
    inspect_image_header, metadata_created_or_modified, metadata_modified,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Runtime};
use uuid::Uuid;
use walkdir::WalkDir;

impl super::LocalBackend {
    pub fn handle_sources_list(&self) -> Result<Value, String> {
        let conn = self.open_connection()?;
        let mut stmt = conn
			.prepare(
				"SELECT id, name, description, type, connection_info FROM media_sources ORDER BY name ASC",
			)
			.map_err(|error| format!("Preparing sources list failed: {error}"))?;
        let rows = stmt
            .query_map([], |row| {
                let connection_info: String = row.get(4)?;
                let parsed: Value =
                    serde_json::from_str(&connection_info).unwrap_or_else(|_| json!({}));
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "type": row.get::<_, String>(3)?,
                    "connectionInfo": parsed,
                }))
            })
            .map_err(|error| format!("Querying sources failed: {error}"))?;
        collect_json_rows(rows)
    }

    pub fn handle_sources_get(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: IdInput = parse_input(input)?;
        let conn = self.open_connection()?;
        self.find_source_value(&conn, &payload.id)?
            .ok_or_else(|| format!("Source not found: {}", payload.id))
    }

    pub fn handle_sources_create<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        input: Option<Value>,
    ) -> Result<Value, String> {
        let payload = input.unwrap_or_else(|| json!({}));
        let name = payload
            .get("name")
            .and_then(Value::as_str)
            .ok_or_else(|| "Source name is required".to_string())?;
        let source_type = payload
            .get("type")
            .and_then(Value::as_str)
            .ok_or_else(|| "Source type is required".to_string())?;
        if source_type != "local" {
            return Err("Tauri currently supports only local sources.".to_string());
        }
        let connection_info = payload
            .get("connectionInfo")
            .cloned()
            .ok_or_else(|| "connectionInfo is required".to_string())?;
        let path = connection_info
            .get("path")
            .and_then(Value::as_str)
            .ok_or_else(|| "Local source path is required".to_string())?;
        if !Path::new(path).exists() {
            return Err(format!("Source path does not exist: {path}"));
        }
        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        let description = payload
            .get("description")
            .and_then(|value| value.as_str().map(|inner| inner.to_string()));
        let conn = self.open_connection()?;
        conn.execute(
			"INSERT INTO media_sources (id, name, description, type, connection_info, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
			params![
				id,
				name,
				description,
				source_type,
				connection_info.to_string(),
				now,
				now,
			],
		)
		.map_err(|error| format!("Creating source failed: {error}"))?;
        let result = self
            .find_source_value(&conn, &id)?
            .ok_or_else(|| "Created source could not be loaded".to_string())?;
        let _ = self.sync_source(app, &id);
        Ok(result)
    }

    pub fn handle_sources_update(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: SourceUpdateInput = parse_input(input)?;
        let conn = self.open_connection()?;
        let existing = self
            .find_source_value(&conn, &payload.id)?
            .ok_or_else(|| format!("Source not found: {}", payload.id))?;
        let mut merged = existing;
        merge_json(&mut merged, &payload.data);
        let source_type = merged
            .get("type")
            .and_then(Value::as_str)
            .ok_or_else(|| "Source type is required".to_string())?;
        if source_type != "local" {
            return Err("Tauri currently supports only local sources.".to_string());
        }
        let connection_info = merged
            .get("connectionInfo")
            .cloned()
            .ok_or_else(|| "connectionInfo is required".to_string())?;
        conn.execute(
			"UPDATE media_sources SET name = ?1, description = ?2, type = ?3, connection_info = ?4, updated_at = ?5 WHERE id = ?6",
			params![
				merged.get("name").and_then(Value::as_str).unwrap_or_default(),
				merged.get("description").and_then(Value::as_str),
				source_type,
				connection_info.to_string(),
				now_iso(),
				payload.id,
			],
		)
		.map_err(|error| format!("Updating source failed: {error}"))?;
        self.find_source_value(&conn, &payload.id)?
            .ok_or_else(|| "Updated source could not be loaded".to_string())
    }

    pub fn handle_sources_delete(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: IdInput = parse_input(input)?;
        let conn = self.open_connection()?;
        conn.execute(
            "DELETE FROM media_sources WHERE id = ?1",
            params![payload.id],
        )
        .map_err(|error| format!("Deleting source failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn handle_sources_sync<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        input: Option<Value>,
    ) -> Result<Value, String> {
        let payload: SyncSourcesInput = parse_input(input)?;
        let mut results = Vec::new();
        for source_id in payload.ids {
            match self.sync_source(app, &source_id) {
                Ok(summary) => results.push(json!({
                    "id": source_id,
                    "success": true,
                    "added": summary.added,
                    "updated": summary.updated,
                    "deleted": summary.deleted,
                })),
                Err(error) => results.push(json!({
                    "id": source_id,
                    "success": false,
                    "error": error,
                })),
            }
        }
        Ok(json!({ "results": results }))
    }

    pub fn sync_source<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        source_id: &str,
    ) -> Result<SyncSummary, String> {
        let conn = self.open_connection()?;
        let source = self
            .find_source_value(&conn, source_id)?
            .ok_or_else(|| format!("Source not found: {source_id}"))?;
        let source_type = source
            .get("type")
            .and_then(Value::as_str)
            .ok_or_else(|| "Source type is missing".to_string())?;
        if source_type != "local" {
            return Err("Tauri currently supports only local sources.".to_string());
        }
        let root_path = source
            .get("connectionInfo")
            .and_then(|value| value.get("path"))
            .and_then(Value::as_str)
            .ok_or_else(|| "Local source path is missing".to_string())?;
        let root = PathBuf::from(root_path);
        let config = self.read_config()?;
        let allowed = build_allowed_extensions(&config.media.supported_extensions);
        let existing = self.list_media_by_source(&conn, source_id)?;
        let mut existing_by_path = existing
            .into_iter()
            .map(|item| (item.file_path.clone(), item))
            .collect::<HashMap<_, _>>();
        let mut seen = HashSet::new();
        let mut summary = SyncSummary {
            added: 0,
            updated: 0,
            deleted: 0,
            processed: 0,
        };

        for entry in WalkDir::new(&root).into_iter().filter_map(Result::ok) {
            if !entry.file_type().is_file() {
                continue;
            }
            let extension = entry
                .path()
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| format!(".{}", value.to_ascii_lowercase()))
                .unwrap_or_default();
            let Some(media_type) = media_type_from_extension(&allowed, &extension) else {
                continue;
            };
            let relative = normalize_relative_path(
                entry
                    .path()
                    .strip_prefix(&root)
                    .map_err(|error| format!("Calculating relative path failed: {error}"))?,
            );
            seen.insert(relative.clone());
            summary.processed += 1;
            let metadata = fs::metadata(entry.path())
                .map_err(|error| format!("Reading file metadata failed: {error}"))?;
            let created_at =
                metadata_created_or_modified(&entry.path().to_string_lossy(), &metadata)?;
            let modified_at = metadata_modified(&entry.path().to_string_lossy(), &metadata)?;
            let (width, height) = if media_type == "image" {
                match inspect_image_header(&entry.path().to_string_lossy()) {
                    Ok(header) => (
                        i64::from(header.dimensions.width),
                        i64::from(header.dimensions.height),
                    ),
                    Err(error) => {
                        eprintln!(
                            "Failed to inspect image header for {}: {}",
                            entry.path().display(),
                            error
                        );
                        (0, 0)
                    }
                }
            } else {
                (0, 0)
            };
            let file_name = entry.file_name().to_string_lossy().to_string();
            let file_size = i64::try_from(metadata.len()).unwrap_or(i64::MAX);
            if let Some(existing_media) = existing_by_path.remove(&relative) {
                if existing_media.modified_at != modified_at
                    || existing_media.file_size != Some(file_size)
                    || existing_media.width != width
                    || existing_media.height != height
                {
                    conn.execute(
						"UPDATE medias SET file_name = ?1, media_type = ?2, width = ?3, height = ?4, file_size = ?5, created_at = ?6, modified_at = ?7, indexed_at = ?8, status = 'active' WHERE id = ?9",
						params![
							file_name,
							media_type,
							width,
							height,
							file_size,
							created_at,
							modified_at,
							now_iso(),
							existing_media.id,
						],
					)
					.map_err(|error| format!("Updating media metadata failed: {error}"))?;
                    if media_type == "image" {
                        self.sync_media_analysis(&conn, &existing_media.id, entry.path())?;
                    }
                    summary.updated += 1;
                    let _ = app.emit(
                        "media-changed",
                        SourceEventPayload {
                            media_source_id: source_id.to_string(),
                            file_path: relative.clone(),
                            media_id: Some(existing_media.id),
                            timestamp: now_iso(),
                        },
                    );
                }
            } else {
                let media_id = Uuid::new_v4().to_string();
                conn.execute(
					"INSERT INTO medias (id, media_source_id, file_path, file_name, media_type, width, height, file_size, description, created_at, modified_at, indexed_at, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9, ?10, ?11, 'active')",
					params![
						media_id,
						source_id,
						relative,
						file_name,
						media_type,
						width,
						height,
						file_size,
						created_at,
						modified_at,
						now_iso(),
					],
				)
				.map_err(|error| format!("Creating media entry failed: {error}"))?;
                if media_type == "image" {
                    self.sync_media_analysis(&conn, &media_id, entry.path())?;
                }
                summary.added += 1;
                let _ = app.emit(
                    "media-added",
                    SourceEventPayload {
                        media_source_id: source_id.to_string(),
                        file_path: relative,
                        media_id: Some(media_id),
                        timestamp: now_iso(),
                    },
                );
            }
        }

        for (file_path, media) in existing_by_path {
            if seen.contains(&file_path) {
                continue;
            }
            conn.execute("DELETE FROM medias WHERE id = ?1", params![media.id])
                .map_err(|error| format!("Deleting removed media failed: {error}"))?;
            summary.deleted += 1;
            let _ = app.emit(
                "media-deleted",
                SourceEventPayload {
                    media_source_id: source_id.to_string(),
                    file_path,
                    media_id: Some(media.id),
                    timestamp: now_iso(),
                },
            );
        }

        let _ = app.emit(
            "all-jobs-completed",
            AllJobsCompletedPayload {
                media_source_id: source_id.to_string(),
                processed: summary.processed,
            },
        );
        Ok(summary)
    }

    pub fn find_source_value(&self, conn: &Connection, id: &str) -> Result<Option<Value>, String> {
        let mut stmt = conn
			.prepare("SELECT id, name, description, type, connection_info FROM media_sources WHERE id = ?1")
			.map_err(|error| format!("Preparing source lookup failed: {error}"))?;
        stmt.query_row(params![id], |row| {
            let connection_info: String = row.get(4)?;
            let parsed: Value =
                serde_json::from_str(&connection_info).unwrap_or_else(|_| json!({}));
            Ok(json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "description": row.get::<_, Option<String>>(2)?,
                "type": row.get::<_, String>(3)?,
                "connectionInfo": parsed,
            }))
        })
        .optional()
        .map_err(|error| format!("Looking up source failed: {error}"))
    }
}
