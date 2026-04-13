use crate::backend::metadata::{
    extract_metadata_from_path, has_extracted_metadata, stringify_prompt_value,
    workflow_to_json_text,
};
use crate::backend::types::ComfyUiTagExtractionConfig;
use crate::backend::{COMFYUI_WORKFLOW_SOURCE, TAG_SOURCE_LOCAL};
use crate::commands::utils::ExtractMetadataResult;
use rusqlite::{params, Connection};
use std::path::Path;

pub struct PreparedMediaAnalysis {
    extracted: ExtractMetadataResult,
}

impl super::LocalBackend {
    pub fn prepare_media_analysis(
        media_path: &Path,
        config: &ComfyUiTagExtractionConfig,
    ) -> Result<PreparedMediaAnalysis, String> {
        let media_path = media_path.to_string_lossy().to_string();
        let extracted = extract_metadata_from_path(&media_path, config)?;
        Ok(PreparedMediaAnalysis { extracted })
    }

    pub fn apply_media_analysis(
        &self,
        conn: &Connection,
        media_id: &str,
        analysis: &PreparedMediaAnalysis,
    ) -> Result<(), String> {
        let extracted = &analysis.extracted;

        conn.execute(
            "DELETE FROM media_tags WHERE media_id = ?1 AND source = ?2",
            params![media_id, COMFYUI_WORKFLOW_SOURCE],
        )
        .map_err(|error| format!("Clearing extracted tags failed: {error}"))?;

        conn.execute(
            "DELETE FROM generation_infos WHERE media_id = ?1",
            params![media_id],
        )
        .map_err(|error| format!("Clearing generation info failed: {error}"))?;

        if !has_extracted_metadata(extracted) {
            return Ok(());
        }

        conn.execute(
            "INSERT INTO generation_infos (media_id, metadata_json, prompt, negative_prompt, workflow_json, loras_json, vae, hypernetworks_json, embeddings_json, ai_generated, model_name, seed, cfg_scale, steps) VALUES (?1, NULL, ?2, NULL, ?3, NULL, NULL, NULL, NULL, ?4, '', 0, 0, 0)",
            params![
                media_id,
                stringify_prompt_value(extracted.prompt.as_ref()),
                workflow_to_json_text(extracted.workflow.as_ref()),
                if has_extracted_metadata(extracted) { 1 } else { 0 },
            ],
        )
        .map_err(|error| format!("Saving generation info failed: {error}"))?;

        for tag in &extracted.tags {
            let tag_id = self.ensure_tag(conn, &tag.name, TAG_SOURCE_LOCAL)?;
            conn.execute(
                "INSERT OR REPLACE INTO media_tags (media_id, tag_id, type, confidence, source) VALUES (?1, ?2, ?3, NULL, ?4)",
                params![media_id, tag_id, tag.tag_type, COMFYUI_WORKFLOW_SOURCE],
            )
            .map_err(|error| format!("Saving extracted tag failed: {error}"))?;
        }

        Ok(())
    }

    pub fn sync_media_analysis(
        &self,
        conn: &Connection,
        media_id: &str,
        media_path: &Path,
    ) -> Result<(), String> {
        let config = self.read_config()?;
        let analysis =
            Self::prepare_media_analysis(media_path, &config.media.tag_extraction.comfyui)?;
        self.apply_media_analysis(conn, media_id, &analysis)
    }
}
