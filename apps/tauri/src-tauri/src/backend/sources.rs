use crate::backend::helpers::*;
use crate::backend::types::*;
use crate::commands::utils::{
    inspect_image_header, metadata_created_or_modified, metadata_modified,
};
use rayon::prelude::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Runtime};
use uuid::Uuid;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

#[derive(Default)]
struct RestoreCaches {
    author_ids: HashMap<String, String>,
    project_ids: HashMap<String, String>,
    tag_ids: HashMap<String, String>,
    ip_ids: HashMap<String, String>,
    character_ids: HashMap<String, String>,
}

struct SourceScanCandidate {
    relative: String,
    path: PathBuf,
    media_type: String,
}

struct IndexedSourceEntry {
    relative: String,
    media_type: String,
    file_name: String,
    file_size: i64,
    created_at: String,
    modified_at: String,
    width: i64,
    height: i64,
    analysis: Option<super::media_processing::PreparedMediaAnalysis>,
}

impl super::LocalBackend {
    fn index_source_entry(
        candidate: SourceScanCandidate,
        tag_extraction_config: &ComfyUiTagExtractionConfig,
    ) -> Result<IndexedSourceEntry, String> {
        let metadata = fs::metadata(&candidate.path)
            .map_err(|error| format!("Reading file metadata failed: {error}"))?;
        let path_text = candidate.path.to_string_lossy().to_string();
        let created_at = metadata_created_or_modified(&path_text, &metadata)?;
        let modified_at = metadata_modified(&path_text, &metadata)?;
        let (width, height, analysis) = if candidate.media_type == "image" {
            let (width, height) = match inspect_image_header(&path_text) {
                Ok(header) => (
                    i64::from(header.dimensions.width),
                    i64::from(header.dimensions.height),
                ),
                Err(error) => {
                    eprintln!(
                        "Failed to inspect image header for {}: {}",
                        candidate.path.display(),
                        error
                    );
                    (0, 0)
                }
            };
            let analysis = Some(Self::prepare_media_analysis(
                &candidate.path,
                tag_extraction_config,
            )?);
            (width, height, analysis)
        } else {
            (0, 0, None)
        };

        Ok(IndexedSourceEntry {
            relative: candidate.relative,
            media_type: candidate.media_type,
            file_name: candidate
                .path
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
                .unwrap_or_default(),
            file_size: i64::try_from(metadata.len()).unwrap_or(i64::MAX),
            created_at,
            modified_at,
            width,
            height,
            analysis,
        })
    }

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

    pub fn handle_sources_restore<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        input: Option<Value>,
    ) -> Result<Value, String> {
        let payload: SourceRestoreInput = parse_input(input)?;
        let _ = self.sync_source_internal(app, &payload.id, false)?;
        self.restore_source_data(&payload.id, &payload.data)
    }

    pub fn handle_sources_dump_zip(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: IdInput = parse_input(input)?;
        let conn = self.open_connection()?;
        let source = self
            .find_source_value(&conn, &payload.id)?
            .ok_or_else(|| format!("Source not found: {}", payload.id))?;
        let dump_items = self.build_source_dump_items(&conn, &payload.id)?;
        let mut writer = ZipWriter::new(Cursor::new(Vec::<u8>::new()));
        let file_options =
            SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

        writer
            .start_file("dump.json", file_options)
            .map_err(|error| format!("Creating dump.json in ZIP failed: {error}"))?;
        let dump_bytes = serde_json::to_vec_pretty(&dump_items)
            .map_err(|error| format!("Serializing ZIP dump failed: {error}"))?;
        writer
            .write_all(&dump_bytes)
            .map_err(|error| format!("Writing dump.json failed: {error}"))?;

        for item in &dump_items {
            let Some(file_path) = item.get("filePath").and_then(Value::as_str) else {
                continue;
            };
            let full_path = self.resolve_media_path(&source, file_path)?;
            let bytes = match fs::read(&full_path) {
                Ok(bytes) => bytes,
                Err(_) => continue,
            };
            writer
                .start_file(format!("images/{file_path}"), file_options)
                .map_err(|error| format!("Adding {file_path} to ZIP failed: {error}"))?;
            writer
                .write_all(&bytes)
                .map_err(|error| format!("Writing {file_path} to ZIP failed: {error}"))?;
        }

        let cursor = writer
            .finish()
            .map_err(|error| format!("Finalizing ZIP dump failed: {error}"))?;

        Ok(json!(BinaryFilePayload {
            file_name: format!("source-{}-dump.zip", payload.id),
            mime_type: "application/zip".to_string(),
            data: cursor.into_inner(),
        }))
    }

    pub fn handle_sources_dump(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: IdInput = parse_input(input)?;
        let conn = self.open_connection()?;
        let items = self.build_source_dump_items(&conn, &payload.id)?;
        Ok(Value::Array(items))
    }

    pub fn handle_sources_import_zip<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        input: Option<Value>,
    ) -> Result<Value, String> {
        let payload: SourceImportZipInput = parse_input(input)?;
        let conn = self.open_connection()?;
        let source = self
            .find_source_value(&conn, &payload.id)?
            .ok_or_else(|| format!("Source not found: {}", payload.id))?;
        let root = self.local_source_root_path(&source)?;

        let cursor = Cursor::new(payload.bytes);
        let mut archive =
            ZipArchive::new(cursor).map_err(|error| format!("Opening ZIP failed: {error}"))?;
        let mut dump_data: Option<Vec<Value>> = None;

        for index in 0..archive.len() {
            let mut entry = archive
                .by_index(index)
                .map_err(|error| format!("Reading ZIP entry failed: {error}"))?;

            if entry.name() == "dump.json" {
                let mut text = String::new();
                entry
                    .read_to_string(&mut text)
                    .map_err(|error| format!("Reading dump.json failed: {error}"))?;
                dump_data = Some(
                    serde_json::from_str::<Vec<Value>>(&text)
                        .map_err(|error| format!("Parsing dump.json failed: {error}"))?,
                );
                continue;
            }

            let Some(enclosed_name) = entry.enclosed_name().map(|path| path.to_path_buf()) else {
                continue;
            };
            let Some(relative_path) = enclosed_name
                .strip_prefix("images")
                .ok()
                .map(normalize_relative_path)
            else {
                continue;
            };
            if relative_path.is_empty() {
                continue;
            }

            let destination = root.join(&relative_path);
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Creating ZIP restore directory failed: {error}"))?;
            }
            let mut output = fs::File::create(&destination)
                .map_err(|error| format!("Creating restored file failed: {error}"))?;
            std::io::copy(&mut entry, &mut output)
                .map_err(|error| format!("Extracting ZIP file failed: {error}"))?;
        }

        let dump_data = dump_data.ok_or_else(|| "dump.json not found in ZIP".to_string())?;
        let _ = self.sync_source_internal(app, &payload.id, false)?;
        let restore_result = self.restore_source_data(&payload.id, &dump_data)?;
        let processed = restore_result
            .get("processed")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        let skipped = restore_result
            .get("skipped")
            .and_then(Value::as_u64)
            .unwrap_or(0);

        Ok(json!({
            "success": true,
            "importedCount": processed,
            "skippedCount": skipped,
            "errors": restore_result.get("errors").cloned().unwrap_or(Value::Array(Vec::new())),
            "message": format!("Successfully imported {processed} items (Skipped: {skipped})"),
        }))
    }

    pub fn sync_source<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        source_id: &str,
    ) -> Result<SyncSummary, String> {
        self.sync_source_internal(app, source_id, true)
    }

    fn sync_source_internal<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        source_id: &str,
        emit_events: bool,
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
        let tag_extraction_config = config.media.tag_extraction.comfyui.clone();
        let concurrency = usize::try_from(config.jobs.concurrency)
            .ok()
            .filter(|value| *value > 0)
            .unwrap_or(1);
        let mut candidates = Vec::new();
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
            candidates.push(SourceScanCandidate {
                relative,
                path: entry.path().to_path_buf(),
                media_type,
            });
        }

        let indexed_entries = rayon::ThreadPoolBuilder::new()
            .num_threads(concurrency)
            .build()
            .map_err(|error| format!("Creating source sync thread pool failed: {error}"))?
            .install(|| {
                candidates
                    .into_par_iter()
                    .map(|candidate| Self::index_source_entry(candidate, &tag_extraction_config))
                    .collect::<Result<Vec<_>, _>>()
            })?;
        let mut seen = HashSet::new();
        let mut summary = SyncSummary {
            added: 0,
            updated: 0,
            deleted: 0,
            processed: indexed_entries.len(),
        };

        for entry in indexed_entries {
            let relative = entry.relative.clone();
            seen.insert(relative.clone());
            if let Some(existing_media) = existing_by_path.remove(&relative) {
                if existing_media.modified_at != entry.modified_at
                    || existing_media.file_size != Some(entry.file_size)
                    || existing_media.width != entry.width
                    || existing_media.height != entry.height
                {
                    conn.execute(
						"UPDATE medias SET file_name = ?1, media_type = ?2, width = ?3, height = ?4, file_size = ?5, created_at = ?6, modified_at = ?7, indexed_at = ?8, status = 'active' WHERE id = ?9",
						params![
							entry.file_name,
							entry.media_type,
							entry.width,
							entry.height,
							entry.file_size,
							entry.created_at,
							entry.modified_at,
							now_iso(),
							existing_media.id,
						],
					)
					.map_err(|error| format!("Updating media metadata failed: {error}"))?;
                    if let Some(analysis) = entry.analysis.as_ref() {
                        self.apply_media_analysis(&conn, &existing_media.id, analysis)?;
                    }
                    summary.updated += 1;
                    if emit_events {
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
                }
            } else {
                let media_id = Uuid::new_v4().to_string();
                conn.execute(
					"INSERT INTO medias (id, media_source_id, file_path, file_name, media_type, width, height, file_size, description, created_at, modified_at, indexed_at, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9, ?10, ?11, 'active')",
					params![
						media_id,
						source_id,
						relative,
						entry.file_name,
						entry.media_type,
						entry.width,
						entry.height,
						entry.file_size,
						entry.created_at,
						entry.modified_at,
						now_iso(),
					],
                )
				.map_err(|error| format!("Creating media entry failed: {error}"))?;
                if let Some(analysis) = entry.analysis.as_ref() {
                    self.apply_media_analysis(&conn, &media_id, analysis)?;
                }
                summary.added += 1;
                if emit_events {
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
        }

        for (file_path, media) in existing_by_path {
            if seen.contains(&file_path) {
                continue;
            }
            conn.execute("DELETE FROM medias WHERE id = ?1", params![media.id])
                .map_err(|error| format!("Deleting removed media failed: {error}"))?;
            summary.deleted += 1;
            if emit_events {
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
        }

        if emit_events {
            let _ = app.emit(
                "all-jobs-completed",
                AllJobsCompletedPayload {
                    media_source_id: source_id.to_string(),
                    processed: summary.processed,
                },
            );
        }
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

    fn local_source_root_path(&self, source: &Value) -> Result<PathBuf, String> {
        let source_type = source
            .get("type")
            .and_then(Value::as_str)
            .ok_or_else(|| "Source type is missing".to_string())?;
        if source_type != "local" {
            return Err("Tauri currently supports only local sources.".to_string());
        }
        source
            .get("connectionInfo")
            .and_then(|value| value.get("path"))
            .and_then(Value::as_str)
            .map(PathBuf::from)
            .ok_or_else(|| "Local source path is missing".to_string())
    }

    fn build_source_dump_items(
        &self,
        conn: &Connection,
        source_id: &str,
    ) -> Result<Vec<Value>, String> {
        let media = self.list_media_by_source(conn, source_id)?;
        let mut items = Vec::with_capacity(media.len());

        for summary in media {
            let details = self
                .get_media_details_value(conn, source_id, &summary.id)?
                .ok_or_else(|| format!("Media not found while building dump: {}", summary.id))?;
            let projects = self.list_projects_for_media_value(conn, &summary.id)?;
            let source_urls = details
                .get("urls")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|url| url.get("url").and_then(Value::as_str))
                .map(|url| Value::String(url.to_string()))
                .collect::<Vec<_>>();

            items.push(json!({
                "id": summary.id,
                "filePath": summary.file_path,
                "fileName": summary.file_name,
                "description": summary.description,
                "width": summary.width,
                "height": summary.height,
                "fileSize": summary.file_size,
                "mediaType": summary.media_type,
                "createdAt": summary.created_at,
                "modifiedAt": summary.modified_at,
                "sourceUrls": source_urls,
                "generationInfo": details.get("generationInfo").cloned().unwrap_or(Value::Null),
                "tags": details.get("tags").cloned().unwrap_or(Value::Array(Vec::new())),
                "authors": details.get("authors").cloned().unwrap_or(Value::Array(Vec::new())),
                "characters": details.get("characters").cloned().unwrap_or(Value::Array(Vec::new())),
                "ips": details.get("ips").cloned().unwrap_or(Value::Array(Vec::new())),
                "projects": projects,
            }));
        }

        Ok(items)
    }

    fn restore_source_data(&self, source_id: &str, items: &[Value]) -> Result<Value, String> {
        let mut conn = self.open_connection()?;
        let source = self
            .find_source_value(&conn, source_id)?
            .ok_or_else(|| format!("Source not found: {source_id}"))?;
        self.local_source_root_path(&source)?;
        let media_by_path = self
            .list_media_by_source(&conn, source_id)?
            .into_iter()
            .map(|summary| (summary.file_path.clone(), summary))
            .collect::<HashMap<_, _>>();

        let mut processed = 0usize;
        let mut skipped = 0usize;
        let mut errors = Vec::new();
        let mut restore_targets = Vec::new();

        for item in items {
            let Some(file_path) = item.get("filePath").and_then(Value::as_str) else {
                skipped += 1;
                errors.push("Skipped item without filePath".to_string());
                continue;
            };
            if !is_safe_relative_path(file_path) {
                skipped += 1;
                errors.push(format!("Invalid path in backup: {file_path}"));
                continue;
            }
            let Some(summary) = media_by_path.get(file_path) else {
                skipped += 1;
                errors.push(format!("Media record not found after sync: {file_path}"));
                continue;
            };
            restore_targets.push((summary.clone(), item));
        }

        let tx = conn
            .transaction()
            .map_err(|error| format!("Starting restore transaction failed: {error}"))?;
        let mut caches = RestoreCaches::default();
        let media_ids = restore_targets
            .iter()
            .map(|(summary, _)| summary.id.clone())
            .collect::<Vec<_>>();

        self.clear_restore_relations(&tx, &media_ids)?;

        for (summary, item) in restore_targets {
            self.restore_media_record(&tx, &summary, item, &mut caches)?;
            processed += 1;
        }

        tx.commit()
            .map_err(|error| format!("Committing restore transaction failed: {error}"))?;

        Ok(json!({
            "processed": processed,
            "skipped": skipped,
            "errors": errors,
        }))
    }

    fn restore_media_record(
        &self,
        conn: &Connection,
        summary: &MediaSummary,
        item: &Value,
        caches: &mut RestoreCaches,
    ) -> Result<(), String> {
        let restored_created_at = item
            .get("createdAt")
            .and_then(Value::as_str)
            .unwrap_or(&summary.created_at);
        let restored_modified_at = item
            .get("modifiedAt")
            .and_then(Value::as_str)
            .unwrap_or(&summary.modified_at);

        conn.execute(
            "UPDATE medias SET description = ?1, created_at = ?2, modified_at = ?3, indexed_at = ?4 WHERE id = ?5",
            params![
                item.get("description").and_then(Value::as_str),
                restored_created_at,
                restored_modified_at,
                now_iso(),
                summary.id,
            ],
        )
        .map_err(|error| format!("Updating restored media failed: {error}"))?;

        if let Some(urls) = item.get("sourceUrls").and_then(Value::as_array) {
            for url in urls.iter().filter_map(Value::as_str) {
                let now = now_iso();
                conn.execute(
                    "INSERT INTO media_urls (id, media_id, url, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![Uuid::new_v4().to_string(), summary.id, url, now, now],
                )
                .map_err(|error| format!("Restoring media URL failed: {error}"))?;
            }
        }

        if let Some(authors) = item.get("authors").and_then(Value::as_array) {
            for author in authors {
                let Some(name) = author.get("name").and_then(Value::as_str) else {
                    continue;
                };
                let author_id = self.ensure_author_cached(
                    conn,
                    caches,
                    name,
                    author.get("accountId").and_then(Value::as_str),
                )?;
                conn.execute(
                    "INSERT OR IGNORE INTO media_authors (media_id, author_id) VALUES (?1, ?2)",
                    params![summary.id, author_id],
                )
                .map_err(|error| format!("Restoring media author failed: {error}"))?;
            }
        }

        if let Some(projects) = item.get("projects").and_then(Value::as_array) {
            for project in projects {
                let Some(name) = project.get("name").and_then(Value::as_str) else {
                    continue;
                };
                let project_id = self.ensure_project_cached(
                    conn,
                    caches,
                    name,
                    project.get("description").and_then(Value::as_str),
                )?;
                conn.execute(
                    "INSERT OR IGNORE INTO media_projects (media_id, project_id) VALUES (?1, ?2)",
                    params![summary.id, project_id],
                )
                .map_err(|error| format!("Restoring media project failed: {error}"))?;
            }
        }

        if let Some(tags) = item.get("tags").and_then(Value::as_array) {
            for tag in tags {
                let Some(name) = tag.get("name").and_then(Value::as_str) else {
                    continue;
                };
                let source = tag
                    .get("source")
                    .and_then(Value::as_str)
                    .unwrap_or("restored");
                let tag_id = self.ensure_tag_cached(conn, caches, name, source)?;
                let tag_type = tag
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or("positive");
                conn.execute(
                    "INSERT OR REPLACE INTO media_tags (media_id, tag_id, type, confidence, source) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        summary.id,
                        tag_id,
                        tag_type,
                        tag.get("confidence").and_then(Value::as_f64),
                        source,
                    ],
                )
                .map_err(|error| format!("Restoring media tag failed: {error}"))?;
            }
        }

        if let Some(ips) = item.get("ips").and_then(Value::as_array) {
            for ip in ips {
                let Some(name) = ip.get("name").and_then(Value::as_str) else {
                    continue;
                };
                let source = ip
                    .get("source")
                    .and_then(Value::as_str)
                    .unwrap_or("restored");
                let ip_id = self.ensure_ip_cached(
                    conn,
                    caches,
                    name,
                    ip.get("description").and_then(Value::as_str),
                    source,
                )?;
                conn.execute(
                    "INSERT OR REPLACE INTO media_ips (media_id, ip_id, confidence, source) VALUES (?1, ?2, ?3, ?4)",
                    params![
                        summary.id,
                        ip_id,
                        ip.get("confidence").and_then(Value::as_f64),
                        source,
                    ],
                )
                .map_err(|error| format!("Restoring media IP failed: {error}"))?;
            }
        }

        if let Some(characters) = item.get("characters").and_then(Value::as_array) {
            for character in characters {
                let Some(name) = character.get("name").and_then(Value::as_str) else {
                    continue;
                };
                let source = character
                    .get("source")
                    .and_then(Value::as_str)
                    .unwrap_or("restored");
                let linked_ip_ids = character
                    .get("linkedIps")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_str)
                    .map(|ip_name| self.ensure_ip_cached(conn, caches, ip_name, None, source))
                    .collect::<Result<Vec<_>, _>>()?;
                let character_id =
                    self.ensure_character_cached(conn, caches, name, source, &linked_ip_ids)?;
                conn.execute(
                    "INSERT OR REPLACE INTO media_characters (media_id, character_id, confidence, source) VALUES (?1, ?2, ?3, ?4)",
                    params![
                        summary.id,
                        character_id,
                        character.get("confidence").and_then(Value::as_f64),
                        source,
                    ],
                )
                .map_err(|error| format!("Restoring media character failed: {error}"))?;
            }
        }

        if let Some(generation_info) = item.get("generationInfo").filter(|value| !value.is_null()) {
            conn.execute(
                "INSERT INTO generation_infos (media_id, metadata_json, prompt, negative_prompt, workflow_json, loras_json, vae, hypernetworks_json, embeddings_json, ai_generated, model_name, seed, cfg_scale, steps) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                params![
                    summary.id,
                    stringify_json_value(generation_info.get("metadata")),
                    generation_info.get("prompt").and_then(Value::as_str),
                    generation_info.get("negativePrompt").and_then(Value::as_str),
                    stringify_json_value(generation_info.get("workflow")),
                    stringify_json_value(generation_info.get("loras")),
                    generation_info.get("vae").and_then(Value::as_str),
                    stringify_json_value(generation_info.get("hypernetworks")),
                    stringify_json_value(generation_info.get("embeddings")),
                    generation_info
                        .get("aiGenerated")
                        .and_then(Value::as_bool)
                        .unwrap_or(false),
                    generation_info
                        .get("modelName")
                        .and_then(Value::as_str)
                        .unwrap_or_default(),
                    generation_info.get("seed").and_then(Value::as_f64).unwrap_or(0.0),
                    generation_info
                        .get("cfgScale")
                        .and_then(Value::as_f64)
                        .unwrap_or(0.0),
                    generation_info.get("steps").and_then(Value::as_f64).unwrap_or(0.0),
                ],
            )
            .map_err(|error| format!("Restoring generation info failed: {error}"))?;
        }

        Ok(())
    }

    fn clear_restore_relations(
        &self,
        conn: &Connection,
        media_ids: &[String],
    ) -> Result<(), String> {
        if media_ids.is_empty() {
            return Ok(());
        }

        let placeholders = (0..media_ids.len())
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ");

        for table in [
            "media_urls",
            "media_authors",
            "media_projects",
            "media_tags",
            "media_ips",
            "media_characters",
            "generation_infos",
        ] {
            let sql = format!("DELETE FROM {table} WHERE media_id IN ({placeholders})");
            conn.execute(&sql, rusqlite::params_from_iter(media_ids.iter()))
                .map_err(|error| format!("Clearing {table} failed: {error}"))?;
        }

        Ok(())
    }

    fn ensure_author_cached(
        &self,
        conn: &Connection,
        caches: &mut RestoreCaches,
        name: &str,
        account_id: Option<&str>,
    ) -> Result<String, String> {
        if let Some(id) = caches.author_ids.get(name) {
            return Ok(id.clone());
        }
        let id = self.ensure_author(conn, name, account_id)?;
        caches.author_ids.insert(name.to_string(), id.clone());
        Ok(id)
    }

    fn ensure_project_cached(
        &self,
        conn: &Connection,
        caches: &mut RestoreCaches,
        name: &str,
        description: Option<&str>,
    ) -> Result<String, String> {
        if let Some(id) = caches.project_ids.get(name) {
            return Ok(id.clone());
        }
        let id = self.ensure_project(conn, name, description)?;
        caches.project_ids.insert(name.to_string(), id.clone());
        Ok(id)
    }

    fn ensure_tag_cached(
        &self,
        conn: &Connection,
        caches: &mut RestoreCaches,
        name: &str,
        source: &str,
    ) -> Result<String, String> {
        if let Some(id) = caches.tag_ids.get(name) {
            return Ok(id.clone());
        }
        let id = self.ensure_tag(conn, name, source)?;
        caches.tag_ids.insert(name.to_string(), id.clone());
        Ok(id)
    }

    fn ensure_ip_cached(
        &self,
        conn: &Connection,
        caches: &mut RestoreCaches,
        name: &str,
        description: Option<&str>,
        source: &str,
    ) -> Result<String, String> {
        if let Some(id) = caches.ip_ids.get(name) {
            return Ok(id.clone());
        }
        let id = self.ensure_ip(conn, name, description, source)?;
        caches.ip_ids.insert(name.to_string(), id.clone());
        Ok(id)
    }

    fn ensure_character_cached(
        &self,
        conn: &Connection,
        caches: &mut RestoreCaches,
        name: &str,
        source: &str,
        ip_ids: &[String],
    ) -> Result<String, String> {
        if let Some(id) = caches.character_ids.get(name) {
            for ip_id in ip_ids {
                conn.execute(
                    "INSERT OR IGNORE INTO character_ips (character_id, ip_id) VALUES (?1, ?2)",
                    params![id.clone(), ip_id],
                )
                .map_err(|error| format!("Linking character to IP failed: {error}"))?;
            }
            return Ok(id.clone());
        }
        let id = self.ensure_character(conn, name, source, ip_ids)?;
        caches.character_ids.insert(name.to_string(), id.clone());
        Ok(id)
    }

    fn find_media_summary_by_source_and_path(
        &self,
        conn: &Connection,
        source_id: &str,
        file_path: &str,
    ) -> Result<Option<MediaSummary>, String> {
        conn
            .query_row(
                "SELECT id, media_source_id, file_path, file_name, media_type, width, height, file_size, description, created_at, modified_at, indexed_at, status FROM medias WHERE media_source_id = ?1 AND file_path = ?2",
                params![source_id, file_path],
                media_summary_from_row,
            )
            .optional()
            .map_err(|error| format!("Looking up media by path failed: {error}"))
    }

    fn ensure_author(
        &self,
        conn: &Connection,
        name: &str,
        account_id: Option<&str>,
    ) -> Result<String, String> {
        if let Some(id) = conn
            .query_row(
                "SELECT id FROM authors WHERE name = ?1",
                params![name],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("Looking up author failed: {error}"))?
        {
            if account_id.is_some() {
                conn.execute(
                    "UPDATE authors SET account_id = COALESCE(?1, account_id), updated_at = ?2 WHERE id = ?3",
                    params![account_id, now_iso(), id],
                )
                .map_err(|error| format!("Updating author failed: {error}"))?;
            }
            return Ok(id);
        }

        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        conn.execute(
            "INSERT INTO authors (id, name, account_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, name, account_id, now, now],
        )
        .map_err(|error| format!("Creating author failed: {error}"))?;
        Ok(id)
    }

    fn ensure_project(
        &self,
        conn: &Connection,
        name: &str,
        description: Option<&str>,
    ) -> Result<String, String> {
        if let Some(id) = conn
            .query_row(
                "SELECT id FROM projects WHERE name = ?1",
                params![name],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| format!("Looking up project failed: {error}"))?
        {
            if description.is_some() {
                conn.execute(
                    "UPDATE projects SET description = COALESCE(?1, description), updated_at = ?2 WHERE id = ?3",
                    params![description, now_iso(), id],
                )
                .map_err(|error| format!("Updating project failed: {error}"))?;
            }
            return Ok(id);
        }

        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        conn.execute(
            "INSERT INTO projects (id, name, description, created_at, updated_at, archived_at) VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
            params![id, name, description, now, now],
        )
        .map_err(|error| format!("Creating project failed: {error}"))?;
        Ok(id)
    }
}

fn is_safe_relative_path(path: &str) -> bool {
    let candidate = Path::new(path);
    !candidate.is_absolute()
        && candidate.components().all(|component| {
            matches!(
                component,
                std::path::Component::Normal(_) | std::path::Component::CurDir
            )
        })
}

fn stringify_json_value(value: Option<&Value>) -> Option<String> {
    value
        .filter(|inner| !inner.is_null())
        .map(serde_json::to_string)
        .transpose()
        .ok()
        .flatten()
}
