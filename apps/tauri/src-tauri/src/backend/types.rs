use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceEventPayload {
    pub media_source_id: String,
    pub file_path: String,
    pub media_id: Option<String>,
    pub timestamp: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AllJobsCompletedPayload {
    pub media_source_id: String,
    pub processed: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgressPayload {
    pub job_id: String,
    pub processed: usize,
    pub total: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobCompletedPayload {
    pub job_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobFailedPayload {
    pub job_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct JobsConfig {
    pub concurrency: u32,
    pub ai_concurrency: u32,
    pub poll_interval_ms: u32,
    pub enable_auto_tagging: bool,
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
pub struct AiConfig {
    pub base_url: String,
    pub timeout_ms: u64,
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
pub struct DownloadsConfig {
    pub rate_limit_enabled: bool,
    pub request_interval_ms: u32,
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
pub struct StorageConfig {
    pub thumbnail_dir: String,
    pub thumbnail_size: u32,
    pub thumbnail_quality: u8,
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
pub struct ComfyUiTagExtractionConfig {
    pub positive_node_types: Vec<String>,
    pub negative_keywords: Vec<String>,
    pub negative_tags: Vec<String>,
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
#[derive(Default)]
pub struct TagExtractionConfig {
    pub comfyui: ComfyUiTagExtractionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SupportedExtensionsConfig {
    pub image: Vec<String>,
    pub video: Vec<String>,
    pub audio: Vec<String>,
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
#[derive(Default)]
pub struct MediaConfig {
    pub supported_extensions: SupportedExtensionsConfig,
    pub tag_extraction: TagExtractionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct LoggingConfig {
    pub level: String,
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
pub struct AppConfig {
    pub version: String,
    pub jobs: JobsConfig,
    pub ai: AiConfig,
    pub downloads: DownloadsConfig,
    pub storage: StorageConfig,
    pub media: MediaConfig,
    pub logging: LoggingConfig,
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
pub struct SearchRequestInput {
    pub source_id: Option<String>,
    pub params: SearchParams,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchParams {
    pub condition: Option<SearchNode>,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum SearchNode {
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
pub struct MediaContext {
    pub summary: MediaSummary,
    pub tags: Vec<String>,
    pub authors: Vec<String>,
    pub projects: Vec<String>,
    pub ips: Vec<String>,
    pub characters: Vec<String>,
    pub prompt: Option<String>,
    pub ai_generated: bool,
    pub favorite: Option<bool>,
    pub rating: Option<f64>,
    pub view_count: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct MediaSummary {
    pub id: String,
    pub media_source_id: String,
    pub file_path: String,
    pub file_name: String,
    pub media_type: String,
    pub width: i64,
    pub height: i64,
    pub file_size: Option<i64>,
    pub description: Option<String>,
    pub created_at: String,
    pub modified_at: String,
    pub indexed_at: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMediaInput {
    pub source_id: String,
    pub media_id: String,
    pub data: UpdateMediaData,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMediaData {
    pub description: Option<Option<String>>,
    pub source_urls: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceUpdateInput {
    pub id: String,
    pub data: Value,
}

#[derive(Debug, Deserialize)]
pub struct IdInput {
    pub id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaIdInput {
    pub source_id: String,
    pub media_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSourcesInput {
    pub ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceRestoreInput {
    pub id: String,
    pub data: Vec<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceImportZipInput {
    pub id: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryFilePayload {
    pub file_name: String,
    pub mime_type: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAssociationInput {
    pub media_id: String,
    pub project_id: Option<String>,
    pub ip_id: Option<String>,
    pub character_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMutationInput {
    pub id: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterMutationInput {
    pub id: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub ip_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetCreateInput {
    pub name: String,
    pub value: Value,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetUpdateInput {
    pub id: i64,
    pub data: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchTaggingScanInput {
    pub force: Option<bool>,
    pub media_source_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchTaggingStartInput {
    pub force: Option<bool>,
    pub media_source_id: Option<String>,
    pub media_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyAiTagsInput {
    pub media_id: String,
    pub response: TaggingResponse,
}

#[derive(Debug, Deserialize)]
pub struct PresetIdInput {
    pub id: i64,
}

#[derive(Debug, Deserialize)]
pub struct NameInput {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct TaggingResponse {
    pub general: HashMap<String, f64>,
    pub character: HashMap<String, f64>,
    pub ips: Vec<String>,
    pub ips_mapping: HashMap<String, Vec<String>>,
}

#[derive(Debug)]
pub struct SyncSummary {
    pub added: usize,
    pub updated: usize,
    pub deleted: usize,
    pub processed: usize,
}
