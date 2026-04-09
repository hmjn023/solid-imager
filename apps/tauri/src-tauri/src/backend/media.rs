use crate::backend::helpers::*;
use crate::backend::types::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use uuid::Uuid;

impl super::LocalBackend {
    pub fn handle_media_search(&self, input: Option<Value>) -> Result<Value, String> {
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

    pub fn handle_media_details(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: MediaIdInput = parse_input(input)?;
        let conn = self.open_connection()?;
        self.get_media_details_value(&conn, &payload.source_id, &payload.media_id)?
            .ok_or_else(|| format!("Media not found: {}", payload.media_id))
    }

    pub fn handle_media_update(&self, input: Option<Value>) -> Result<Value, String> {
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
            conn.execute(
                "DELETE FROM media_urls WHERE media_id = ?1",
                params![payload.media_id.clone()],
            )
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

    pub fn list_media_by_source(
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

    pub fn load_media_contexts(
        &self,
        source_id: Option<&str>,
    ) -> Result<Vec<MediaContext>, String> {
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
            stmt.query_map(params![source_id], media_summary_from_row)
                .map_err(|error| format!("Querying media search failed: {error}"))?
        } else {
            stmt.query_map([], media_summary_from_row)
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

    pub fn has_ai_metadata(&self, item: &MediaContext) -> bool {
        item.ai_generated
            || !item.tags.is_empty()
            || !item.ips.is_empty()
            || !item.characters.is_empty()
    }

    pub fn get_media_details_value(
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

    pub fn generation_info_value(
        &self,
        conn: &Connection,
        media_id: &str,
    ) -> Result<Value, String> {
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

    pub fn list_urls_for_media_value(
        &self,
        conn: &Connection,
        media_id: &str,
    ) -> Result<Value, String> {
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

    pub fn list_authors_for_media_value(
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

    pub fn list_tags_for_media_value(
        &self,
        conn: &Connection,
        media_id: &str,
    ) -> Result<Value, String> {
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

    pub fn list_projects_for_media_value(
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

    pub fn list_ips_for_media_value(
        &self,
        conn: &Connection,
        media_id: &str,
    ) -> Result<Value, String> {
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

    pub fn list_characters_for_media_value(
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

    pub fn find_media_summary_by_id(
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

    pub fn list_tag_names_for_media(
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

    pub fn list_author_names_for_media(
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

    pub fn list_project_names_for_media(
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

    pub fn list_ip_names_for_media(
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

    pub fn list_character_names_for_media(
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

    pub fn resolve_media_path(&self, source: &Value, file_path: &str) -> Result<PathBuf, String> {
        let root = source
            .get("connectionInfo")
            .and_then(|value| value.get("path"))
            .and_then(Value::as_str)
            .ok_or_else(|| "Local source path is missing".to_string())?;
        Ok(Path::new(root).join(file_path))
    }
}
