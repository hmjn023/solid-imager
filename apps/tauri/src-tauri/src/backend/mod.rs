pub mod ai;
pub mod authors;
pub mod characters;
pub mod config;
pub mod db;
pub mod helpers;
pub mod ips;
pub mod media;
pub mod media_processing;
pub mod metadata;
pub mod presets;
pub mod projects;
pub mod sources;
pub mod tags;
pub mod types;
pub mod utils;

use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};
pub const DB_FILE_NAME: &str = "metadata.sqlite3";
pub const LEGACY_CONFIG_FILE_NAME: &str = "config.json";
pub const AI_SOURCE: &str = "AI";
pub const COMFYUI_WORKFLOW_SOURCE: &str = "comfyui_workflow";
pub const TAG_SOURCE_LOCAL: &str = "local";

#[derive(Clone)]
pub struct LocalBackend {
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub legacy_config_path: PathBuf,
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
            legacy_config_path: data_dir.join(LEGACY_CONFIG_FILE_NAME),
            data_dir,
        };
        backend.initialize()?;
        Ok(backend)
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
            "sources.list" => self.handle_sources_list(),
            "sources.get" => self.handle_sources_get(input),
            "sources.create" => self.handle_sources_create(app, input),
            "sources.update" => self.handle_sources_update(input),
            "sources.delete" => self.handle_sources_delete(input),
            "sources.sync" => self.handle_sources_sync(app, input),
            "sources.restore" => self.handle_sources_restore(app, input),
            "sources.dump" => self.handle_sources_dump(input),
            "sources.dumpZip" => self.handle_sources_dump_zip(input),
            "sources.importZip" => self.handle_sources_import_zip(app, input),
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
            "ai.applyTags" => self.handle_ai_apply_tags(input),
            "ai.scanBatchTaggingTargets" => self.handle_ai_scan(input),
            "ai.startBatchTaggingWithIds" => self.handle_ai_start(app, input),
            _ => Err(format!("Unsupported Tauri API procedure: {procedure}")),
        }
    }
}
