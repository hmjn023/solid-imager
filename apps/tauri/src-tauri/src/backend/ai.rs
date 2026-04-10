use crate::backend::helpers::*;
use crate::backend::types::*;
use crate::backend::AI_SOURCE;
use reqwest::blocking::{multipart, Client};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};
use uuid::Uuid;

impl super::LocalBackend {
    pub fn handle_ai_scan(&self, input: Option<Value>) -> Result<Value, String> {
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

    pub fn handle_ai_start<R: Runtime>(
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

    pub fn process_batch_tagging<R: Runtime>(
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

    pub fn tag_single_media<R: Runtime>(
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
                multipart::Form::new()
                    .part("file", multipart::Part::bytes(bytes).file_name(file_name)),
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

    pub fn save_ai_tags(
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
}
