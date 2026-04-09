use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use reqwest::blocking::{multipart, Client};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use uuid::Uuid;
use walkdir::WalkDir;

use crate::{get_dimensions_from_header, metadata_created_or_modified, metadata_modified};

const DB_FILE_NAME: &str = "metadata.sqlite3";
const CONFIG_FILE_NAME: &str = "config.json";
const AI_SOURCE: &str = "AI";

#[derive(Clone)]
pub struct LocalBackend {
	data_dir: PathBuf,
	db_path: PathBuf,
	config_path: PathBuf,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceEventPayload {
	media_source_id: String,
	file_path: String,
	media_id: Option<String>,
	timestamp: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AllJobsCompletedPayload {
	media_source_id: String,
	processed: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobProgressPayload {
	job_id: String,
	processed: usize,
	total: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobCompletedPayload {
	job_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JobFailedPayload {
	job_id: String,
	error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct JobsConfig {
	concurrency: u32,
	ai_concurrency: u32,
	poll_interval_ms: u32,
	enable_auto_tagging: bool,
}

impl Default for JobsConfig {
	fn default() -> Self {
		Self {
			concurrency: 3,
			ai_concurrency: 1,
			poll_interval_ms: 1000,
			enable_auto_tagging: false,
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct AiConfig {
	base_url: String,
	timeout_ms: u64,
}

impl Default for AiConfig {
	fn default() -> Self {
		Self {
			base_url: "http://localhost:8000".to_string(),
			timeout_ms: 120_000,
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct DownloadsConfig {
	rate_limit_enabled: bool,
	request_interval_ms: u32,
}

impl Default for DownloadsConfig {
	fn default() -> Self {
		Self {
			rate_limit_enabled: true,
			request_interval_ms: 1000,
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct StorageConfig {
	thumbnail_dir: String,
	thumbnail_size: u32,
	thumbnail_quality: u8,
}

impl Default for StorageConfig {
	fn default() -> Self {
		Self {
			thumbnail_dir: ".cache/thumbnails".to_string(),
			thumbnail_size: 512,
			thumbnail_quality: 80,
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct ComfyUiTagExtractionConfig {
	positive_node_types: Vec<String>,
	negative_keywords: Vec<String>,
	negative_tags: Vec<String>,
}

impl Default for ComfyUiTagExtractionConfig {
	fn default() -> Self {
		Self {
			positive_node_types: vec![
				"CLIPTextEncode".to_string(),
				"CR Combine Prompt".to_string(),
			],
			negative_keywords: vec!["negative".to_string()],
			negative_tags: vec!["lowres".to_string()],
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct TagExtractionConfig {
	comfyui: ComfyUiTagExtractionConfig,
}

impl Default for TagExtractionConfig {
	fn default() -> Self {
		Self {
			comfyui: ComfyUiTagExtractionConfig::default(),
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct SupportedExtensionsConfig {
	image: Vec<String>,
	video: Vec<String>,
	audio: Vec<String>,
}

impl Default for SupportedExtensionsConfig {
	#[allow(clippy::assigning_clones)]
	fn default() -> Self {
		Self {
			image: vec![
				".jpg".to_string(),
				".jpeg".to_string(),
				".png".to_string(),
				".webp".to_string(),
			],
			video: vec![".mp4".to_string(), ".webm".to_string(), ".mov".to_string()],
			audio: vec![".mp3".to_string(), ".wav".to_string()],
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct MediaConfig {
	supported_extensions: SupportedExtensionsConfig,
	tag_extraction: TagExtractionConfig,
}

impl Default for MediaConfig {
	fn default() -> Self {
		Self {
			supported_extensions: SupportedExtensionsConfig::default(),
			tag_extraction: TagExtractionConfig::default(),
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct LoggingConfig {
	level: String,
}

impl Default for LoggingConfig {
	fn default() -> Self {
		Self {
			level: "info".to_string(),
		}
	}
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct AppConfig {
	version: String,
	jobs: JobsConfig,
	ai: AiConfig,
	downloads: DownloadsConfig,
	storage: StorageConfig,
	media: MediaConfig,
	logging: LoggingConfig,
}

impl Default for AppConfig {
	fn default() -> Self {
		Self {
			version: "1.0.0".to_string(),
			jobs: JobsConfig::default(),
			ai: AiConfig::default(),
			downloads: DownloadsConfig::default(),
			storage: StorageConfig::default(),
			media: MediaConfig::default(),
			logging: LoggingConfig::default(),
		}
	}
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchRequestInput {
	source_id: Option<String>,
	params: SearchParams,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchParams {
	condition: Option<SearchNode>,
	sort: Option<String>,
	order: Option<String>,
	limit: Option<usize>,
	offset: Option<usize>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum SearchNode {
	Criterion {
		target: String,
		operator: Option<String>,
		value: Option<Value>,
		negate: Option<bool>,
	},
	Group {
		operator: String,
		children: Vec<SearchNode>,
		negate: Option<bool>,
	},
}

#[derive(Debug, Clone)]
struct MediaContext {
	summary: MediaSummary,
	tags: Vec<String>,
	authors: Vec<String>,
	projects: Vec<String>,
	ips: Vec<String>,
	characters: Vec<String>,
	prompt: Option<String>,
	ai_generated: bool,
}

#[derive(Debug, Clone)]
struct MediaSummary {
	id: String,
	media_source_id: String,
	file_path: String,
	file_name: String,
	media_type: String,
	width: i64,
	height: i64,
	file_size: Option<i64>,
	description: Option<String>,
	created_at: String,
	modified_at: String,
	indexed_at: String,
	status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateMediaInput {
	source_id: String,
	media_id: String,
	data: UpdateMediaData,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateMediaData {
	description: Option<Option<String>>,
	source_urls: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceUpdateInput {
	id: String,
	data: Value,
}

#[derive(Debug, Deserialize)]
struct IdInput {
	id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaIdInput {
	source_id: String,
	media_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncSourcesInput {
	ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaAssociationInput {
	media_id: String,
	project_id: Option<String>,
	ip_id: Option<String>,
	character_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectMutationInput {
	id: Option<String>,
	name: Option<String>,
	description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CharacterMutationInput {
	id: Option<String>,
	name: Option<String>,
	description: Option<String>,
	ip_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PresetCreateInput {
	name: String,
	value: Value,
	sort: Option<String>,
	order: Option<String>,
	mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PresetUpdateInput {
	id: i64,
	data: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchTaggingScanInput {
	force: Option<bool>,
	media_source_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchTaggingStartInput {
	force: Option<bool>,
	media_source_id: Option<String>,
	media_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct PresetIdInput {
	id: i64,
}

#[derive(Debug, Deserialize)]
struct NameInput {
	name: String,
}

#[derive(Debug, Deserialize)]
struct TaggingResponse {
	general: HashMap<String, f64>,
	character: HashMap<String, f64>,
	ips: Vec<String>,
	ips_mapping: HashMap<String, Vec<String>>,
}

#[derive(Debug)]
struct SyncSummary {
	added: usize,
	updated: usize,
	deleted: usize,
	processed: usize,
}

impl LocalBackend {
	pub fn new<R: Runtime>(app: &AppHandle<R>) -> Result<Self, String> {
		let data_dir = app
			.path()
			.app_data_dir()
			.map_err(|error| format!("Resolving app data dir failed: {error}"))?;
		fs::create_dir_all(&data_dir)
			.map_err(|error| format!("Creating app data dir failed: {error}"))?;

		let backend = Self {
			db_path: data_dir.join(DB_FILE_NAME),
			config_path: data_dir.join(CONFIG_FILE_NAME),
			data_dir,
		};
		backend.initialize()?;
		Ok(backend)
	}

	fn initialize(&self) -> Result<(), String> {
		if !self.config_path.exists() {
			self.write_config(&AppConfig::default())?;
		}
		let conn = self.open_connection()?;
		conn.execute_batch(
			r#"
			PRAGMA foreign_keys = ON;
			PRAGMA journal_mode = WAL;

			CREATE TABLE IF NOT EXISTS media_sources (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				type TEXT NOT NULL,
				connection_info TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS medias (
				id TEXT PRIMARY KEY,
				media_source_id TEXT NOT NULL,
				file_path TEXT NOT NULL,
				file_name TEXT NOT NULL,
				media_type TEXT NOT NULL,
				width INTEGER NOT NULL,
				height INTEGER NOT NULL,
				file_size INTEGER,
				description TEXT,
				created_at TEXT NOT NULL,
				modified_at TEXT NOT NULL,
				indexed_at TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'active',
				UNIQUE(media_source_id, file_path),
				FOREIGN KEY(media_source_id) REFERENCES media_sources(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS media_urls (
				id TEXT PRIMARY KEY,
				media_id TEXT NOT NULL,
				url TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS authors (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				account_id TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS media_authors (
				media_id TEXT NOT NULL,
				author_id TEXT NOT NULL,
				PRIMARY KEY(media_id, author_id),
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE,
				FOREIGN KEY(author_id) REFERENCES authors(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS tags (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				description TEXT,
				attribute TEXT,
				color TEXT,
				source TEXT NOT NULL,
				author_id TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS media_tags (
				media_id TEXT NOT NULL,
				tag_id TEXT NOT NULL,
				type TEXT NOT NULL,
				confidence REAL,
				source TEXT NOT NULL,
				PRIMARY KEY(media_id, tag_id, type, source),
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE,
				FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS projects (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				description TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				archived_at TEXT
			);

			CREATE TABLE IF NOT EXISTS media_projects (
				media_id TEXT NOT NULL,
				project_id TEXT NOT NULL,
				PRIMARY KEY(media_id, project_id),
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE,
				FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS ips (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				description TEXT,
				source TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS media_ips (
				media_id TEXT NOT NULL,
				ip_id TEXT NOT NULL,
				confidence REAL,
				source TEXT NOT NULL,
				PRIMARY KEY(media_id, ip_id, source),
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE,
				FOREIGN KEY(ip_id) REFERENCES ips(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS characters (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				description TEXT,
				source TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS character_ips (
				character_id TEXT NOT NULL,
				ip_id TEXT NOT NULL,
				PRIMARY KEY(character_id, ip_id),
				FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
				FOREIGN KEY(ip_id) REFERENCES ips(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS media_characters (
				media_id TEXT NOT NULL,
				character_id TEXT NOT NULL,
				confidence REAL,
				source TEXT NOT NULL,
				PRIMARY KEY(media_id, character_id, source),
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE,
				FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS generation_infos (
				media_id TEXT PRIMARY KEY,
				metadata_json TEXT,
				prompt TEXT,
				negative_prompt TEXT,
				workflow_json TEXT,
				loras_json TEXT,
				vae TEXT,
				hypernetworks_json TEXT,
				embeddings_json TEXT,
				ai_generated INTEGER NOT NULL DEFAULT 0,
				model_name TEXT NOT NULL DEFAULT '',
				seed REAL NOT NULL DEFAULT 0,
				cfg_scale REAL NOT NULL DEFAULT 0,
				steps REAL NOT NULL DEFAULT 0,
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS presets (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL UNIQUE,
				value_json TEXT NOT NULL,
				sort TEXT,
				order_value TEXT,
				mode TEXT,
				created_at TEXT NOT NULL
			);
			"#,
		)
		.map_err(|error| format!("Initializing local database failed: {error}"))?;
		Ok(())
	}

	fn open_connection(&self) -> Result<Connection, String> {
		let conn = Connection::open(&self.db_path)
			.map_err(|error| format!("Opening local database failed: {error}"))?;
		conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
			.map_err(|error| format!("Configuring local database failed: {error}"))?;
		Ok(conn)
	}

	pub fn data_dir(&self) -> &Path {
		&self.data_dir
	}

	pub fn handle_call<R: Runtime>(
		&self,
		app: &AppHandle<R>,
		procedure: &str,
		input: Option<Value>,
	) -> Result<Value, String> {
		match procedure {
			"config.get" => Ok(serde_json::to_value(self.read_config()?)
				.map_err(|error| format!("Serializing config failed: {error}"))?),
			"config.update" => self.handle_config_update(input),
			"sources.list" => self.handle_sources_list(),
			"sources.get" => self.handle_sources_get(input),
			"sources.create" => self.handle_sources_create(app, input),
			"sources.update" => self.handle_sources_update(input),
			"sources.delete" => self.handle_sources_delete(input),
			"sources.sync" => self.handle_sources_sync(app, input),
			"media.search" => self.handle_media_search(input),
			"media.getDetails" => self.handle_media_details(input),
			"media.update" => self.handle_media_update(input),
			"projects.list" => self.handle_projects_list(),
			"projects.create" => self.handle_project_create(input),
			"projects.update" => self.handle_project_update(input),
			"projects.delete" => self.handle_project_delete(input),
			"projects.listForMedia" => self.handle_projects_for_media(input),
			"projects.addToMedia" => self.handle_project_add_to_media(input),
			"projects.removeFromMedia" => self.handle_project_remove_from_media(input),
			"ips.list" => self.handle_ips_list(),
			"ips.create" => self.handle_ip_create(input),
			"ips.update" => self.handle_ip_update(input),
			"ips.delete" => self.handle_ip_delete(input),
			"ips.listForMedia" => self.handle_ips_for_media(input),
			"ips.addToMedia" => self.handle_ip_add_to_media(input),
			"ips.removeFromMedia" => self.handle_ip_remove_from_media(input),
			"characters.list" => self.handle_characters_list(),
			"characters.create" => self.handle_character_create(input),
			"characters.update" => self.handle_character_update(input),
			"characters.delete" => self.handle_character_delete(input),
			"characters.listForMedia" => self.handle_characters_for_media(input),
			"characters.addToMedia" => self.handle_character_add_to_media(input),
			"characters.removeFromMedia" => self.handle_character_remove_from_media(input),
			"authors.list" => self.handle_authors_list(),
			"tags.list" => self.handle_tags_list(),
			"presets.list" => self.handle_presets_list(),
			"presets.get" => self.handle_presets_get(input),
			"presets.getByName" => self.handle_presets_get_by_name(input),
			"presets.create" => self.handle_presets_create(input),
			"presets.update" => self.handle_presets_update(input),
			"presets.delete" => self.handle_presets_delete(input),
			"ai.scanBatchTaggingTargets" => self.handle_ai_scan(input),
			"ai.startBatchTaggingWithIds" => self.handle_ai_start(app, input),
			_ => Err(format!("Unsupported Tauri API procedure: {procedure}")),
		}
	}

	fn handle_config_update(&self, input: Option<Value>) -> Result<Value, String> {
		let patch = input.unwrap_or_else(|| json!({}));
		let mut current = serde_json::to_value(self.read_config()?)
			.map_err(|error| format!("Serializing config failed: {error}"))?;
		merge_json(&mut current, &patch);
		let merged: AppConfig = serde_json::from_value(current)
			.map_err(|error| format!("Validating config failed: {error}"))?;
		self.write_config(&merged)?;
		Ok(serde_json::to_value(merged)
			.map_err(|error| format!("Serializing config failed: {error}"))?)
	}

	fn handle_sources_list(&self) -> Result<Value, String> {
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

	fn handle_sources_get(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: IdInput = parse_input(input)?;
		let conn = self.open_connection()?;
		self.find_source_value(&conn, &payload.id)?
			.ok_or_else(|| format!("Source not found: {}", payload.id))
	}

	fn handle_sources_create<R: Runtime>(
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

	fn handle_sources_update(&self, input: Option<Value>) -> Result<Value, String> {
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

	fn handle_sources_delete(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: IdInput = parse_input(input)?;
		let conn = self.open_connection()?;
		conn.execute("DELETE FROM media_sources WHERE id = ?1", params![payload.id])
			.map_err(|error| format!("Deleting source failed: {error}"))?;
		Ok(json!({ "success": true }))
	}

	fn handle_sources_sync<R: Runtime>(
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

	fn handle_media_search(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: SearchRequestInput = parse_input(input)?;
		let mut items = self.load_media_contexts(payload.source_id.as_deref())?;
		if let Some(condition) = payload.params.condition.as_ref() {
			items.retain(|item| evaluate_node(condition, item));
		}
		sort_media_contexts(
			&mut items,
			payload.params.sort.as_deref().unwrap_or("date"),
			payload.params.order.as_deref().unwrap_or("desc"),
		);
		let total = items.len();
		let offset = payload.params.offset.unwrap_or(0);
		let limit = payload.params.limit.unwrap_or(20);
		let media = items
			.into_iter()
			.skip(offset)
			.take(limit)
			.map(|item| media_summary_to_value(&item.summary))
			.collect::<Vec<_>>();
		Ok(json!({
			"media": media,
			"total": total,
		}))
	}

	fn handle_media_details(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: MediaIdInput = parse_input(input)?;
		let conn = self.open_connection()?;
		self.get_media_details_value(&conn, &payload.source_id, &payload.media_id)?
			.ok_or_else(|| format!("Media not found: {}", payload.media_id))
	}

	fn handle_media_update(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: UpdateMediaInput = parse_input(input)?;
		let conn = self.open_connection()?;
		if let Some(description) = payload.data.description {
			conn.execute(
				"UPDATE medias SET description = ?1, indexed_at = ?2 WHERE id = ?3 AND media_source_id = ?4",
				params![description, now_iso(), payload.media_id, payload.source_id],
			)
			.map_err(|error| format!("Updating media description failed: {error}"))?;
		}
		if let Some(urls) = payload.data.source_urls {
			conn.execute("DELETE FROM media_urls WHERE media_id = ?1", params![payload.media_id.clone()])
				.map_err(|error| format!("Clearing media URLs failed: {error}"))?;
			for url in urls {
				let now = now_iso();
				conn.execute(
					"INSERT INTO media_urls (id, media_id, url, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
					params![Uuid::new_v4().to_string(), payload.media_id, url, now, now],
				)
				.map_err(|error| format!("Creating media URL failed: {error}"))?;
			}
		}
		self.get_media_details_value(&conn, &payload.source_id, &payload.media_id)?
			.ok_or_else(|| format!("Media not found: {}", payload.media_id))
	}

	fn handle_projects_list(&self) -> Result<Value, String> {
		let conn = self.open_connection()?;
		let mut stmt = conn
			.prepare(
				"SELECT id, name, description, created_at, updated_at, archived_at FROM projects ORDER BY name ASC",
			)
			.map_err(|error| format!("Preparing projects list failed: {error}"))?;
		let rows = stmt
			.query_map([], |row| {
				Ok(json!({
					"id": row.get::<_, String>(0)?,
					"name": row.get::<_, String>(1)?,
					"description": row.get::<_, Option<String>>(2)?,
					"createdAt": row.get::<_, String>(3)?,
					"updatedAt": row.get::<_, String>(4)?,
					"archivedAt": row.get::<_, Option<String>>(5)?,
				}))
			})
			.map_err(|error| format!("Querying projects failed: {error}"))?;
		collect_json_rows(rows)
	}

	fn handle_project_create(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: ProjectMutationInput = parse_input(input)?;
		let name = payload
			.name
			.ok_or_else(|| "Project name is required".to_string())?;
		let conn = self.open_connection()?;
		let id = Uuid::new_v4().to_string();
		let now = now_iso();
		conn.execute(
			"INSERT INTO projects (id, name, description, created_at, updated_at, archived_at) VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
			params![id, name, payload.description, now, now],
		)
		.map_err(|error| format!("Creating project failed: {error}"))?;
		self.find_project_value(&conn, &id)?
			.ok_or_else(|| "Created project could not be loaded".to_string())
	}

	fn handle_project_update(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: Value = input.ok_or_else(|| "Missing project update payload".to_string())?;
		let id = payload
			.get("id")
			.and_then(Value::as_str)
			.ok_or_else(|| "Project id is required".to_string())?;
		let data = payload.get("data").cloned().unwrap_or_else(|| json!({}));
		let conn = self.open_connection()?;
		let mut current = self
			.find_project_value(&conn, id)?
			.ok_or_else(|| format!("Project not found: {id}"))?;
		merge_json(&mut current, &data);
		conn.execute(
			"UPDATE projects SET name = ?1, description = ?2, archived_at = ?3, updated_at = ?4 WHERE id = ?5",
			params![
				current.get("name").and_then(Value::as_str).unwrap_or_default(),
				current.get("description").and_then(Value::as_str),
				current.get("archivedAt").and_then(Value::as_str),
				now_iso(),
				id,
			],
		)
		.map_err(|error| format!("Updating project failed: {error}"))?;
		self.find_project_value(&conn, id)?
			.ok_or_else(|| "Updated project could not be loaded".to_string())
	}

	fn handle_project_delete(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: IdInput = parse_input(input)?;
		let conn = self.open_connection()?;
		conn.execute("DELETE FROM projects WHERE id = ?1", params![payload.id])
			.map_err(|error| format!("Deleting project failed: {error}"))?;
		Ok(json!({ "success": true }))
	}

	fn handle_projects_for_media(&self, input: Option<Value>) -> Result<Value, String> {
		let payload = parse_media_only_input(input)?;
		let conn = self.open_connection()?;
		self.list_projects_for_media_value(&conn, &payload)
	}

	fn handle_project_add_to_media(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: MediaAssociationInput = parse_input(input)?;
		let project_id = payload
			.project_id
			.ok_or_else(|| "projectId is required".to_string())?;
		let conn = self.open_connection()?;
		conn.execute(
			"INSERT OR IGNORE INTO media_projects (media_id, project_id) VALUES (?1, ?2)",
			params![payload.media_id, project_id],
		)
		.map_err(|error| format!("Adding project to media failed: {error}"))?;
		Ok(json!({ "success": true }))
	}

	fn handle_project_remove_from_media(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: MediaAssociationInput = parse_input(input)?;
		let project_id = payload
			.project_id
			.ok_or_else(|| "projectId is required".to_string())?;
		let conn = self.open_connection()?;
		conn.execute(
			"DELETE FROM media_projects WHERE media_id = ?1 AND project_id = ?2",
			params![payload.media_id, project_id],
		)
		.map_err(|error| format!("Removing project from media failed: {error}"))?;
		Ok(json!({ "success": true }))
	}

	fn handle_ips_list(&self) -> Result<Value, String> {
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

	fn handle_ip_create(&self, input: Option<Value>) -> Result<Value, String> {
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

	fn handle_ip_update(&self, input: Option<Value>) -> Result<Value, String> {
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
				current.get("name").and_then(Value::as_str).unwrap_or_default(),
				current.get("description").and_then(Value::as_str),
				now_iso(),
				id,
			],
		)
		.map_err(|error| format!("Updating IP failed: {error}"))?;
		self.find_ip_value(&conn, id)?
			.ok_or_else(|| "Updated IP could not be loaded".to_string())
	}

	fn handle_ip_delete(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: IdInput = parse_input(input)?;
		let conn = self.open_connection()?;
		conn.execute("DELETE FROM ips WHERE id = ?1", params![payload.id])
			.map_err(|error| format!("Deleting IP failed: {error}"))?;
		Ok(json!({ "success": true }))
	}

	fn handle_ips_for_media(&self, input: Option<Value>) -> Result<Value, String> {
		let payload = parse_media_only_input(input)?;
		let conn = self.open_connection()?;
		self.list_ips_for_media_value(&conn, &payload)
	}

	fn handle_ip_add_to_media(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: MediaAssociationInput = parse_input(input)?;
		let ip_id = payload.ip_id.ok_or_else(|| "ipId is required".to_string())?;
		let conn = self.open_connection()?;
		conn.execute(
			"INSERT OR IGNORE INTO media_ips (media_id, ip_id, confidence, source) VALUES (?1, ?2, NULL, 'manual')",
			params![payload.media_id, ip_id],
		)
		.map_err(|error| format!("Adding IP to media failed: {error}"))?;
		Ok(json!({ "success": true }))
	}

	fn handle_ip_remove_from_media(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: MediaAssociationInput = parse_input(input)?;
		let ip_id = payload.ip_id.ok_or_else(|| "ipId is required".to_string())?;
		let conn = self.open_connection()?;
		conn.execute(
			"DELETE FROM media_ips WHERE media_id = ?1 AND ip_id = ?2",
			params![payload.media_id, ip_id],
		)
		.map_err(|error| format!("Removing IP from media failed: {error}"))?;
		Ok(json!({ "success": true }))
	}

	fn handle_characters_list(&self) -> Result<Value, String> {
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

	fn handle_character_create(&self, input: Option<Value>) -> Result<Value, String> {
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

	fn handle_character_update(&self, input: Option<Value>) -> Result<Value, String> {
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
				current.get("name").and_then(Value::as_str).unwrap_or_default(),
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

	fn handle_character_delete(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: IdInput = parse_input(input)?;
		let conn = self.open_connection()?;
		conn.execute("DELETE FROM characters WHERE id = ?1", params![payload.id])
			.map_err(|error| format!("Deleting character failed: {error}"))?;
		Ok(json!({ "success": true }))
	}

	fn handle_characters_for_media(&self, input: Option<Value>) -> Result<Value, String> {
		let payload = parse_media_only_input(input)?;
		let conn = self.open_connection()?;
		self.list_characters_for_media_value(&conn, &payload)
	}

	fn handle_character_add_to_media(&self, input: Option<Value>) -> Result<Value, String> {
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

	fn handle_character_remove_from_media(&self, input: Option<Value>) -> Result<Value, String> {
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

	fn handle_authors_list(&self) -> Result<Value, String> {
		let conn = self.open_connection()?;
		let mut stmt = conn
			.prepare("SELECT id, name, account_id, created_at, updated_at FROM authors ORDER BY name ASC")
			.map_err(|error| format!("Preparing authors list failed: {error}"))?;
		let rows = stmt
			.query_map([], |row| {
				Ok(json!({
					"id": row.get::<_, String>(0)?,
					"name": row.get::<_, String>(1)?,
					"accountId": row.get::<_, Option<String>>(2)?,
					"createdAt": row.get::<_, String>(3)?,
					"updatedAt": row.get::<_, String>(4)?,
				}))
			})
			.map_err(|error| format!("Querying authors failed: {error}"))?;
		collect_json_rows(rows)
	}

	fn handle_tags_list(&self) -> Result<Value, String> {
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

	fn handle_presets_list(&self) -> Result<Value, String> {
		let conn = self.open_connection()?;
		let mut stmt = conn
			.prepare("SELECT id, name, value_json, sort, order_value, mode, created_at FROM presets ORDER BY id ASC")
			.map_err(|error| format!("Preparing presets list failed: {error}"))?;
		let rows = stmt
			.query_map([], |row| preset_row_to_value(row))
			.map_err(|error| format!("Querying presets failed: {error}"))?;
		collect_json_rows(rows)
	}

	fn handle_presets_get(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: PresetIdInput = parse_input(input)?;
		let conn = self.open_connection()?;
		self.find_preset_value(&conn, payload.id)?
			.ok_or_else(|| format!("Preset not found: {}", payload.id))
	}

	fn handle_presets_get_by_name(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: NameInput = parse_input(input)?;
		let conn = self.open_connection()?;
		let mut stmt = conn
			.prepare("SELECT id, name, value_json, sort, order_value, mode, created_at FROM presets WHERE name = ?1")
			.map_err(|error| format!("Preparing preset lookup failed: {error}"))?;
		stmt
			.query_row(params![payload.name], preset_row_to_value)
			.optional()
			.map_err(|error| format!("Looking up preset failed: {error}"))?
			.ok_or_else(|| format!("Preset not found: {}", payload.name))
	}

	fn handle_presets_create(&self, input: Option<Value>) -> Result<Value, String> {
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

	fn handle_presets_update(&self, input: Option<Value>) -> Result<Value, String> {
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

	fn handle_presets_delete(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: PresetIdInput = parse_input(input)?;
		let conn = self.open_connection()?;
		conn.execute("DELETE FROM presets WHERE id = ?1", params![payload.id])
			.map_err(|error| format!("Deleting preset failed: {error}"))?;
		Ok(json!({ "success": true }))
	}

	fn handle_ai_scan(&self, input: Option<Value>) -> Result<Value, String> {
		let payload: BatchTaggingScanInput = parse_input(input)?;
		let force = payload.force.unwrap_or(false);
		let contexts = self.load_media_contexts(payload.media_source_id.as_deref())?;
		let result = contexts
			.into_iter()
			.filter(|item| item.summary.media_type == "image")
			.filter(|item| {
				if force {
					return true;
				}
				!self.has_ai_metadata(item)
			})
			.map(|item| media_summary_to_value(&item.summary))
			.collect::<Vec<_>>();
		Ok(Value::Array(result))
	}

	fn handle_ai_start<R: Runtime>(
		&self,
		app: &AppHandle<R>,
		input: Option<Value>,
	) -> Result<Value, String> {
		let payload: BatchTaggingStartInput = parse_input(input)?;
		if payload.media_ids.is_empty() {
			return Err("mediaIds is required".to_string());
		}
		let job_id = Uuid::new_v4().to_string();
		let response_job_id = job_id.clone();
		let backend = Arc::new(self.clone());
		let app_handle = app.clone();
		thread::spawn(move || {
			let emit_handle = app_handle.clone();
			if let Err(error) = backend.process_batch_tagging(
				app_handle,
				job_id.clone(),
				payload.media_ids,
				payload.force.unwrap_or(false),
			) {
				let _ = emit_handle.emit(
					"job-failed",
					JobFailedPayload {
						job_id: job_id.clone(),
						error,
					},
				);
			}
		});
		Ok(json!({
			"success": true,
			"message": "Batch tagging started with selected media.",
			"jobId": response_job_id,
		}))
	}

	fn process_batch_tagging<R: Runtime>(
		&self,
		app: AppHandle<R>,
		job_id: String,
		media_ids: Vec<String>,
		force: bool,
	) -> Result<(), String> {
		let total = media_ids.len();
		for (index, media_id) in media_ids.iter().enumerate() {
			self.tag_single_media(&app, media_id, force)?;
			let _ = app.emit(
				"job-progress",
				JobProgressPayload {
					job_id: job_id.clone(),
					processed: index + 1,
					total,
				},
			);
		}
		let _ = app.emit(
			"job-completed",
			JobCompletedPayload {
				job_id: job_id.clone(),
			},
		);
		Ok(())
	}

	fn tag_single_media<R: Runtime>(
		&self,
		app: &AppHandle<R>,
		media_id: &str,
		force: bool,
	) -> Result<(), String> {
		let conn = self.open_connection()?;
		let summary = self
			.find_media_summary_by_id(&conn, media_id)?
			.ok_or_else(|| format!("Media not found: {media_id}"))?;
		if summary.media_type != "image" {
			return Ok(());
		}
		if !force {
			let context = self
				.load_media_contexts(Some(&summary.media_source_id))?
				.into_iter()
				.find(|item| item.summary.id == media_id);
			if let Some(item) = context {
				if self.has_ai_metadata(&item) {
					return Ok(());
				}
			}
		}
		let source = self
			.find_source_value(&conn, &summary.media_source_id)?
			.ok_or_else(|| format!("Source not found: {}", summary.media_source_id))?;
		let full_path = self.resolve_media_path(&source, &summary.file_path)?;
		let config = self.read_config()?;
		let client = Client::builder()
			.timeout(Duration::from_millis(config.ai.timeout_ms))
			.build()
			.map_err(|error| format!("Creating AI HTTP client failed: {error}"))?;
		let bytes = fs::read(&full_path)
			.map_err(|error| format!("Reading media for AI tagging failed: {error}"))?;
		let file_name = Path::new(&summary.file_name)
			.file_name()
			.and_then(|value| value.to_str())
			.unwrap_or("image.bin")
			.to_string();
		let request = client
			.post(format!("{}/tag", config.ai.base_url.trim_end_matches('/')))
			.multipart(
				multipart::Form::new().part(
					"file",
					multipart::Part::bytes(bytes).file_name(file_name),
				),
			);
		let response = request
			.send()
			.map_err(|error| format!("Calling AI service failed: {error}"))?;
		if !response.status().is_success() {
			return Err(format!("AI service returned {}", response.status()));
		}
		let tagging: TaggingResponse = response
			.json()
			.map_err(|error| format!("Parsing AI response failed: {error}"))?;
		self.save_ai_tags(&conn, &summary, tagging)?;
		let _ = app.emit(
			"media-changed",
			SourceEventPayload {
				media_source_id: summary.media_source_id,
				file_path: summary.file_path,
				media_id: Some(summary.id),
				timestamp: now_iso(),
			},
		);
		Ok(())
	}

	fn save_ai_tags(
		&self,
		conn: &Connection,
		summary: &MediaSummary,
		response: TaggingResponse,
	) -> Result<(), String> {
		conn.execute(
			"DELETE FROM media_tags WHERE media_id = ?1 AND source = ?2",
			params![summary.id, AI_SOURCE],
		)
		.map_err(|error| format!("Clearing AI tags failed: {error}"))?;
		conn.execute(
			"DELETE FROM media_ips WHERE media_id = ?1 AND source = ?2",
			params![summary.id, AI_SOURCE],
		)
		.map_err(|error| format!("Clearing AI IPs failed: {error}"))?;
		conn.execute(
			"DELETE FROM media_characters WHERE media_id = ?1 AND source = ?2",
			params![summary.id, AI_SOURCE],
		)
		.map_err(|error| format!("Clearing AI characters failed: {error}"))?;

		for (name, confidence) in response.general {
			let tag_id = self.ensure_tag(conn, &name, AI_SOURCE)?;
			conn.execute(
				"INSERT OR REPLACE INTO media_tags (media_id, tag_id, type, confidence, source) VALUES (?1, ?2, 'positive', ?3, ?4)",
				params![summary.id, tag_id, confidence, AI_SOURCE],
			)
			.map_err(|error| format!("Saving AI tag failed: {error}"))?;
		}

		let mut ip_id_by_name = HashMap::new();
		for name in response.ips {
			let ip_id = self.ensure_ip(conn, &name, Some(AI_SOURCE), AI_SOURCE)?;
			ip_id_by_name.insert(name, ip_id.clone());
			conn.execute(
				"INSERT OR REPLACE INTO media_ips (media_id, ip_id, confidence, source) VALUES (?1, ?2, NULL, ?3)",
				params![summary.id, ip_id, AI_SOURCE],
			)
			.map_err(|error| format!("Saving AI IP failed: {error}"))?;
		}

		for (name, confidence) in response.character {
			let ip_ids = response
				.ips_mapping
				.get(&name)
				.map(|items| {
					items
						.iter()
						.filter_map(|ip_name| ip_id_by_name.get(ip_name).cloned())
						.collect::<Vec<_>>()
				})
				.unwrap_or_default();
			let character_id = self.ensure_character(conn, &name, AI_SOURCE, &ip_ids)?;
			conn.execute(
				"INSERT OR REPLACE INTO media_characters (media_id, character_id, confidence, source) VALUES (?1, ?2, ?3, ?4)",
				params![summary.id, character_id, confidence, AI_SOURCE],
			)
			.map_err(|error| format!("Saving AI character failed: {error}"))?;
		}
		Ok(())
	}

	fn sync_source<R: Runtime>(
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
			let created_at = metadata_created_or_modified(&entry.path().to_string_lossy(), &metadata)?;
			let modified_at = metadata_modified(&entry.path().to_string_lossy(), &metadata)?;
			let (width, height) = if media_type == "image" {
				match get_dimensions_from_header(&entry.path().to_string_lossy()) {
					Ok(dimensions) => (i64::from(dimensions.width), i64::from(dimensions.height)),
					Err(_) => (0, 0),
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

	fn list_media_by_source(
		&self,
		conn: &Connection,
		source_id: &str,
	) -> Result<Vec<MediaSummary>, String> {
		let mut stmt = conn
			.prepare(
				"SELECT id, media_source_id, file_path, file_name, media_type, width, height, file_size, description, created_at, modified_at, indexed_at, status FROM medias WHERE media_source_id = ?1 ORDER BY file_path ASC",
			)
			.map_err(|error| format!("Preparing media list failed: {error}"))?;
		let rows = stmt
			.query_map(params![source_id], media_summary_from_row)
			.map_err(|error| format!("Querying media list failed: {error}"))?;
		collect_typed_rows(rows)
	}

	fn load_media_contexts(&self, source_id: Option<&str>) -> Result<Vec<MediaContext>, String> {
		let conn = self.open_connection()?;
		let sql = if source_id.is_some() {
			"SELECT id, media_source_id, file_path, file_name, media_type, width, height, file_size, description, created_at, modified_at, indexed_at, status FROM medias WHERE media_source_id = ?1 ORDER BY modified_at DESC"
		} else {
			"SELECT id, media_source_id, file_path, file_name, media_type, width, height, file_size, description, created_at, modified_at, indexed_at, status FROM medias ORDER BY modified_at DESC"
		};
		let mut stmt = conn
			.prepare(sql)
			.map_err(|error| format!("Preparing media search failed: {error}"))?;
		let rows = if let Some(source_id) = source_id {
			stmt
				.query_map(params![source_id], media_summary_from_row)
				.map_err(|error| format!("Querying media search failed: {error}"))?
		} else {
			stmt
				.query_map([], media_summary_from_row)
				.map_err(|error| format!("Querying media search failed: {error}"))?
		};
		let summaries = collect_typed_rows(rows)?;
		let mut contexts = Vec::with_capacity(summaries.len());
		for summary in summaries {
			let tags = self.list_tag_names_for_media(&conn, &summary.id)?;
			let authors = self.list_author_names_for_media(&conn, &summary.id)?;
			let projects = self.list_project_names_for_media(&conn, &summary.id)?;
			let ips = self.list_ip_names_for_media(&conn, &summary.id)?;
			let characters = self.list_character_names_for_media(&conn, &summary.id)?;
			let prompt = conn
				.query_row(
					"SELECT prompt FROM generation_infos WHERE media_id = ?1",
					params![summary.id.clone()],
					|row| row.get::<_, Option<String>>(0),
				)
				.optional()
				.map_err(|error| format!("Querying generation prompt failed: {error}"))?
				.flatten();
			let ai_generated = conn
				.query_row(
					"SELECT ai_generated FROM generation_infos WHERE media_id = ?1",
					params![summary.id.clone()],
					|row| row.get::<_, i64>(0),
				)
				.optional()
				.map_err(|error| format!("Querying AI generated flag failed: {error}"))?
				.unwrap_or(0)
				!= 0;
			contexts.push(MediaContext {
				summary,
				tags,
				authors,
				projects,
				ips,
				characters,
				prompt,
				ai_generated,
			});
		}
		Ok(contexts)
	}

	fn has_ai_metadata(&self, item: &MediaContext) -> bool {
		item.ai_generated || !item.tags.is_empty() || !item.ips.is_empty() || !item.characters.is_empty()
	}

	fn get_media_details_value(
		&self,
		conn: &Connection,
		source_id: &str,
		media_id: &str,
	) -> Result<Option<Value>, String> {
		let summary = conn
			.query_row(
				"SELECT id, media_source_id, file_path, file_name, media_type, width, height, file_size, description, created_at, modified_at, indexed_at, status FROM medias WHERE media_source_id = ?1 AND id = ?2",
				params![source_id, media_id],
				media_summary_from_row,
			)
			.optional()
			.map_err(|error| format!("Loading media details failed: {error}"))?;
		let Some(summary) = summary else {
			return Ok(None);
		};
		let tags = self.list_tags_for_media_value(conn, &summary.id)?;
		let authors = self.list_authors_for_media_value(conn, &summary.id)?;
		let urls = self.list_urls_for_media_value(conn, &summary.id)?;
		let characters = self.list_characters_for_media_value(conn, &summary.id)?;
		let ips = self.list_ips_for_media_value(conn, &summary.id)?;
		let generation_info = self.generation_info_value(conn, &summary.id)?;
		Ok(Some(json!({
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
			"tags": tags,
			"generationInfo": generation_info,
			"authors": authors,
			"urls": urls,
			"characters": characters,
			"ips": ips,
		})))
	}

	fn generation_info_value(&self, conn: &Connection, media_id: &str) -> Result<Value, String> {
		let mut stmt = conn
			.prepare("SELECT metadata_json, prompt, negative_prompt, workflow_json, loras_json, vae, hypernetworks_json, embeddings_json, ai_generated, model_name, seed, cfg_scale, steps FROM generation_infos WHERE media_id = ?1")
			.map_err(|error| format!("Preparing generation info query failed: {error}"))?;
		let value = stmt
			.query_row(params![media_id], |row| {
				Ok(json!({
					"mediaId": media_id,
					"metadata": parse_json_text(row.get::<_, Option<String>>(0)?),
					"prompt": row.get::<_, Option<String>>(1)?,
					"negativePrompt": row.get::<_, Option<String>>(2)?,
					"workflow": parse_json_text(row.get::<_, Option<String>>(3)?),
					"loras": parse_json_text(row.get::<_, Option<String>>(4)?),
					"vae": row.get::<_, Option<String>>(5)?,
					"hypernetworks": parse_json_text(row.get::<_, Option<String>>(6)?),
					"embeddings": parse_json_text(row.get::<_, Option<String>>(7)?),
					"aiGenerated": row.get::<_, i64>(8)? != 0,
					"modelName": row.get::<_, String>(9)?,
					"seed": row.get::<_, f64>(10)?,
					"cfgScale": row.get::<_, f64>(11)?,
					"steps": row.get::<_, f64>(12)?,
				}))
			})
			.optional()
			.map_err(|error| format!("Loading generation info failed: {error}"))?;
		Ok(value.unwrap_or(Value::Null))
	}

	fn list_urls_for_media_value(&self, conn: &Connection, media_id: &str) -> Result<Value, String> {
		let mut stmt = conn
			.prepare("SELECT id, url, created_at, updated_at FROM media_urls WHERE media_id = ?1 ORDER BY created_at ASC")
			.map_err(|error| format!("Preparing media URL query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| {
				Ok(json!({
					"id": row.get::<_, String>(0)?,
					"mediaId": media_id,
					"url": row.get::<_, String>(1)?,
					"createdAt": row.get::<_, String>(2)?,
					"updatedAt": row.get::<_, String>(3)?,
				}))
			})
			.map_err(|error| format!("Querying media URLs failed: {error}"))?;
		collect_json_rows(rows)
	}

	fn list_authors_for_media_value(
		&self,
		conn: &Connection,
		media_id: &str,
	) -> Result<Value, String> {
		let mut stmt = conn
			.prepare(
				"SELECT a.id, a.name, a.account_id, a.created_at, a.updated_at FROM authors a INNER JOIN media_authors ma ON ma.author_id = a.id WHERE ma.media_id = ?1 ORDER BY a.name ASC",
			)
			.map_err(|error| format!("Preparing author query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| {
				Ok(json!({
					"id": row.get::<_, String>(0)?,
					"name": row.get::<_, String>(1)?,
					"accountId": row.get::<_, Option<String>>(2)?,
					"createdAt": row.get::<_, String>(3)?,
					"updatedAt": row.get::<_, String>(4)?,
				}))
			})
			.map_err(|error| format!("Querying authors for media failed: {error}"))?;
		collect_json_rows(rows)
	}

	fn list_tags_for_media_value(&self, conn: &Connection, media_id: &str) -> Result<Value, String> {
		let mut stmt = conn
			.prepare(
				"SELECT t.id, t.name, t.description, t.attribute, t.color, t.source, t.author_id, t.created_at, t.updated_at, mt.type, mt.confidence FROM tags t INNER JOIN media_tags mt ON mt.tag_id = t.id WHERE mt.media_id = ?1 ORDER BY t.name ASC",
			)
			.map_err(|error| format!("Preparing media tag query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| {
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
					"type": row.get::<_, String>(9)?,
					"confidence": row.get::<_, Option<f64>>(10)?,
				}))
			})
			.map_err(|error| format!("Querying tags for media failed: {error}"))?;
		collect_json_rows(rows)
	}

	fn list_projects_for_media_value(
		&self,
		conn: &Connection,
		media_id: &str,
	) -> Result<Value, String> {
		let mut stmt = conn
			.prepare(
				"SELECT p.id, p.name, p.description, p.created_at, p.updated_at, p.archived_at FROM projects p INNER JOIN media_projects mp ON mp.project_id = p.id WHERE mp.media_id = ?1 ORDER BY p.name ASC",
			)
			.map_err(|error| format!("Preparing project-media query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| {
				Ok(json!({
					"id": row.get::<_, String>(0)?,
					"name": row.get::<_, String>(1)?,
					"description": row.get::<_, Option<String>>(2)?,
					"createdAt": row.get::<_, String>(3)?,
					"updatedAt": row.get::<_, String>(4)?,
					"archivedAt": row.get::<_, Option<String>>(5)?,
				}))
			})
			.map_err(|error| format!("Querying projects for media failed: {error}"))?;
		collect_json_rows(rows)
	}

	fn list_ips_for_media_value(&self, conn: &Connection, media_id: &str) -> Result<Value, String> {
		let mut stmt = conn
			.prepare(
				"SELECT i.id, i.name, i.description, i.source, i.created_at, i.updated_at, mi.confidence, mi.source FROM ips i INNER JOIN media_ips mi ON mi.ip_id = i.id WHERE mi.media_id = ?1 ORDER BY i.name ASC",
			)
			.map_err(|error| format!("Preparing IP-media query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| {
				Ok(json!({
					"id": row.get::<_, String>(0)?,
					"name": row.get::<_, String>(1)?,
					"description": row.get::<_, Option<String>>(2)?,
					"source": row.get::<_, String>(3)?,
					"createdAt": row.get::<_, String>(4)?,
					"updatedAt": row.get::<_, String>(5)?,
					"confidence": row.get::<_, Option<f64>>(6)?,
					"linkSource": row.get::<_, String>(7)?,
				}))
			})
			.map_err(|error| format!("Querying IPs for media failed: {error}"))?;
		collect_json_rows(rows)
	}

	fn list_characters_for_media_value(
		&self,
		conn: &Connection,
		media_id: &str,
	) -> Result<Value, String> {
		let mut stmt = conn
			.prepare(
				"SELECT c.id, c.name, c.description, c.source, c.created_at, c.updated_at, mc.confidence, mc.source FROM characters c INNER JOIN media_characters mc ON mc.character_id = c.id WHERE mc.media_id = ?1 ORDER BY c.name ASC",
			)
			.map_err(|error| format!("Preparing character-media query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| {
				Ok((
					row.get::<_, String>(0)?,
					row.get::<_, String>(1)?,
					row.get::<_, Option<String>>(2)?,
					row.get::<_, String>(3)?,
					row.get::<_, String>(4)?,
					row.get::<_, String>(5)?,
					row.get::<_, Option<f64>>(6)?,
					row.get::<_, String>(7)?,
				))
			})
			.map_err(|error| format!("Querying characters for media failed: {error}"))?;
		let mut items = Vec::new();
		for row in rows {
			let (
				character_id,
				name,
				description,
				source,
				created_at,
				updated_at,
				confidence,
				link_source,
			) = row.map_err(|error| format!("Collecting character rows failed: {error}"))?;
			items.push(json!({
				"id": character_id.clone(),
				"name": name,
				"description": description,
				"source": source,
				"aliases": Value::Null,
				"createdAt": created_at,
				"updatedAt": updated_at,
				"confidence": confidence,
				"linkSource": link_source,
				"ips": self.list_ips_for_character_value(conn, &character_id)?,
			}));
		}
		Ok(Value::Array(items))
	}

	fn list_ips_for_character_value(
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

	fn find_source_value(&self, conn: &Connection, id: &str) -> Result<Option<Value>, String> {
		let mut stmt = conn
			.prepare("SELECT id, name, description, type, connection_info FROM media_sources WHERE id = ?1")
			.map_err(|error| format!("Preparing source lookup failed: {error}"))?;
		stmt
			.query_row(params![id], |row| {
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

	fn find_project_value(&self, conn: &Connection, id: &str) -> Result<Option<Value>, String> {
		conn
			.query_row(
				"SELECT id, name, description, created_at, updated_at, archived_at FROM projects WHERE id = ?1",
				params![id],
				|row| {
					Ok(json!({
						"id": row.get::<_, String>(0)?,
						"name": row.get::<_, String>(1)?,
						"description": row.get::<_, Option<String>>(2)?,
						"createdAt": row.get::<_, String>(3)?,
						"updatedAt": row.get::<_, String>(4)?,
						"archivedAt": row.get::<_, Option<String>>(5)?,
					}))
				},
			)
			.optional()
			.map_err(|error| format!("Looking up project failed: {error}"))
	}

	fn find_ip_value(&self, conn: &Connection, id: &str) -> Result<Option<Value>, String> {
		conn
			.query_row(
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

	fn find_character_value(
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

	fn find_preset_value(&self, conn: &Connection, id: i64) -> Result<Option<Value>, String> {
		let mut stmt = conn
			.prepare("SELECT id, name, value_json, sort, order_value, mode, created_at FROM presets WHERE id = ?1")
			.map_err(|error| format!("Preparing preset lookup failed: {error}"))?;
		stmt
			.query_row(params![id], preset_row_to_value)
			.optional()
			.map_err(|error| format!("Looking up preset failed: {error}"))
	}

	fn find_media_summary_by_id(
		&self,
		conn: &Connection,
		media_id: &str,
	) -> Result<Option<MediaSummary>, String> {
		conn
			.query_row(
				"SELECT id, media_source_id, file_path, file_name, media_type, width, height, file_size, description, created_at, modified_at, indexed_at, status FROM medias WHERE id = ?1",
				params![media_id],
				media_summary_from_row,
			)
			.optional()
			.map_err(|error| format!("Looking up media failed: {error}"))
	}

	fn list_entity_ids(&self, conn: &Connection, table: &str) -> Result<Vec<String>, String> {
		let mut stmt = conn
			.prepare(&format!("SELECT id FROM {table} ORDER BY name ASC"))
			.map_err(|error| format!("Preparing entity id query failed: {error}"))?;
		let rows = stmt
			.query_map([], |row| row.get::<_, String>(0))
			.map_err(|error| format!("Querying entity ids failed: {error}"))?;
		collect_typed_rows(rows)
	}

	fn replace_character_ips(
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

	fn ensure_tag(&self, conn: &Connection, name: &str, source: &str) -> Result<String, String> {
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

	fn ensure_ip(
		&self,
		conn: &Connection,
		name: &str,
		description: Option<&str>,
		source: &str,
	) -> Result<String, String> {
		if let Some(id) = conn
			.query_row(
				"SELECT id FROM ips WHERE name = ?1",
				params![name],
				|row| row.get::<_, String>(0),
			)
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

	fn ensure_character(
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

	fn list_tag_names_for_media(
		&self,
		conn: &Connection,
		media_id: &str,
	) -> Result<Vec<String>, String> {
		let mut stmt = conn
			.prepare(
				"SELECT t.name FROM tags t INNER JOIN media_tags mt ON mt.tag_id = t.id WHERE mt.media_id = ?1 ORDER BY t.name ASC",
			)
			.map_err(|error| format!("Preparing tag name query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| row.get::<_, String>(0))
			.map_err(|error| format!("Querying tag names failed: {error}"))?;
		collect_typed_rows(rows)
	}

	fn list_author_names_for_media(
		&self,
		conn: &Connection,
		media_id: &str,
	) -> Result<Vec<String>, String> {
		let mut stmt = conn
			.prepare(
				"SELECT a.name FROM authors a INNER JOIN media_authors ma ON ma.author_id = a.id WHERE ma.media_id = ?1 ORDER BY a.name ASC",
			)
			.map_err(|error| format!("Preparing author name query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| row.get::<_, String>(0))
			.map_err(|error| format!("Querying author names failed: {error}"))?;
		collect_typed_rows(rows)
	}

	fn list_project_names_for_media(
		&self,
		conn: &Connection,
		media_id: &str,
	) -> Result<Vec<String>, String> {
		let mut stmt = conn
			.prepare(
				"SELECT p.name FROM projects p INNER JOIN media_projects mp ON mp.project_id = p.id WHERE mp.media_id = ?1 ORDER BY p.name ASC",
			)
			.map_err(|error| format!("Preparing project name query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| row.get::<_, String>(0))
			.map_err(|error| format!("Querying project names failed: {error}"))?;
		collect_typed_rows(rows)
	}

	fn list_ip_names_for_media(
		&self,
		conn: &Connection,
		media_id: &str,
	) -> Result<Vec<String>, String> {
		let mut stmt = conn
			.prepare(
				"SELECT i.name FROM ips i INNER JOIN media_ips mi ON mi.ip_id = i.id WHERE mi.media_id = ?1 ORDER BY i.name ASC",
			)
			.map_err(|error| format!("Preparing IP name query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| row.get::<_, String>(0))
			.map_err(|error| format!("Querying IP names failed: {error}"))?;
		collect_typed_rows(rows)
	}

	fn list_character_names_for_media(
		&self,
		conn: &Connection,
		media_id: &str,
	) -> Result<Vec<String>, String> {
		let mut stmt = conn
			.prepare(
				"SELECT c.name FROM characters c INNER JOIN media_characters mc ON mc.character_id = c.id WHERE mc.media_id = ?1 ORDER BY c.name ASC",
			)
			.map_err(|error| format!("Preparing character name query failed: {error}"))?;
		let rows = stmt
			.query_map(params![media_id], |row| row.get::<_, String>(0))
			.map_err(|error| format!("Querying character names failed: {error}"))?;
		collect_typed_rows(rows)
	}

	fn resolve_media_path(&self, source: &Value, file_path: &str) -> Result<PathBuf, String> {
		let root = source
			.get("connectionInfo")
			.and_then(|value| value.get("path"))
			.and_then(Value::as_str)
			.ok_or_else(|| "Local source path is missing".to_string())?;
		Ok(Path::new(root).join(file_path))
	}

	fn read_config(&self) -> Result<AppConfig, String> {
		let text = fs::read_to_string(&self.config_path)
			.map_err(|error| format!("Reading config file failed: {error}"))?;
		serde_json::from_str(&text).map_err(|error| format!("Parsing config file failed: {error}"))
	}

	fn write_config(&self, config: &AppConfig) -> Result<(), String> {
		let text = serde_json::to_string_pretty(config)
			.map_err(|error| format!("Serializing config failed: {error}"))?;
		fs::write(&self.config_path, text)
			.map_err(|error| format!("Writing config file failed: {error}"))
	}
}

fn parse_input<T: for<'de> Deserialize<'de>>(input: Option<Value>) -> Result<T, String> {
	let value = input.unwrap_or_else(|| json!({}));
	serde_json::from_value(value).map_err(|error| format!("Invalid input: {error}"))
}

fn parse_media_only_input(input: Option<Value>) -> Result<String, String> {
	let value = input.unwrap_or_else(|| json!({}));
	value
		.get("mediaId")
		.and_then(Value::as_str)
		.map(ToOwned::to_owned)
		.ok_or_else(|| "mediaId is required".to_string())
}

fn collect_json_rows<T>(
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

fn collect_typed_rows<T>(
	rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>>,
) -> Result<Vec<T>, String> {
	let mut values = Vec::new();
	for row in rows {
		values.push(row.map_err(|error| format!("Collecting query rows failed: {error}"))?);
	}
	Ok(values)
}

fn media_summary_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<MediaSummary> {
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

fn media_summary_to_value(summary: &MediaSummary) -> Value {
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

fn preset_row_to_value(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
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

fn build_allowed_extensions(config: &SupportedExtensionsConfig) -> HashMap<String, String> {
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

fn media_type_from_extension(
	allowed: &HashMap<String, String>,
	extension: &str,
) -> Option<String> {
	allowed.get(extension).cloned()
}

fn normalize_relative_path(path: &Path) -> String {
	path
		.components()
		.map(|component| component.as_os_str().to_string_lossy())
		.collect::<Vec<_>>()
		.join("/")
}

fn now_iso() -> String {
	chrono::Utc::now().to_rfc3339()
}

fn parse_json_text(value: Option<String>) -> Value {
	value
		.and_then(|text| serde_json::from_str(&text).ok())
		.unwrap_or(Value::Null)
}

fn merge_json(target: &mut Value, patch: &Value) {
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

fn evaluate_node(node: &SearchNode, item: &MediaContext) -> bool {
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

fn evaluate_criterion(
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
		"description" => compare_optional_string(item.summary.description.as_deref(), operator, value),
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

fn compare_string(value: &str, operator: &str, input: Option<&Value>) -> bool {
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
			.map(|items| items.iter().filter_map(Value::as_str).any(|candidate| candidate.eq_ignore_ascii_case(value)))
			.unwrap_or(false),
		"notIn" => input
			.and_then(Value::as_array)
			.map(|items| items.iter().filter_map(Value::as_str).all(|candidate| !candidate.eq_ignore_ascii_case(value)))
			.unwrap_or(false),
		_ => input
			.and_then(Value::as_str)
			.map(|candidate| candidate.eq_ignore_ascii_case(value))
			.unwrap_or(false),
	}
}

fn compare_optional_string(value: Option<&str>, operator: &str, input: Option<&Value>) -> bool {
	match value {
		Some(value) => compare_string(value, operator, input),
		None => matches!(operator, "isEmpty"),
	}
}

fn compare_list(values: &[String], operator: &str, input: Option<&Value>) -> bool {
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

fn compare_bool(value: bool, operator: &str, input: Option<&Value>) -> bool {
	match operator {
		"isEmpty" => false,
		"isNotEmpty" => true,
		_ => input
			.and_then(Value::as_bool)
			.map(|candidate| candidate == value)
			.unwrap_or(false),
	}
}

fn compare_number(value: f64, operator: &str, input: Option<&Value>) -> bool {
	let candidate = input.and_then(|value| value.as_f64());
	match operator {
		"gt" => candidate.map(|other| value > other).unwrap_or(false),
		"gte" => candidate.map(|other| value >= other).unwrap_or(false),
		"lt" => candidate.map(|other| value < other).unwrap_or(false),
		"lte" => candidate.map(|other| value <= other).unwrap_or(false),
		"isEmpty" => false,
		"isNotEmpty" => true,
		_ => candidate.map(|other| (value - other).abs() < f64::EPSILON).unwrap_or(false),
	}
}

fn sort_media_contexts(items: &mut [MediaContext], sort: &str, order: &str) {
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
