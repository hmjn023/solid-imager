use chrono::{DateTime, Utc};
use image::{DynamicImage, ImageFormat, ImageReader};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::{self};
use std::time::SystemTime;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeMediaResult {
    pub width: u32,
    pub height: u32,
    pub size: u64,
    pub created_at: String,
    pub modified_at: String,
    pub duration: Option<f64>,
    pub mime_type: Option<String>,
    pub codec: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TauriFileStat {
    pub size: u64,
    pub mtime: String,
    pub birthtime: String,
    pub is_directory: bool,
}

#[derive(Serialize)]
pub struct ExtractedTag {
    pub name: String,
    #[serde(rename = "type")]
    pub tag_type: &'static str,
}

#[derive(Serialize)]
pub struct ExtractMetadataResult {
    pub tags: Vec<ExtractedTag>,
    pub prompt: Option<Value>,
    pub workflow: Option<Value>,
}

#[derive(Serialize, Clone, Copy)]
pub struct MediaDimensions {
    pub width: u32,
    pub height: u32,
}

pub struct ImageHeaderInfo {
    pub dimensions: MediaDimensions,
    pub mime_type: Option<String>,
}

#[derive(Deserialize)]
pub struct MkdirOptions {
    pub recursive: Option<bool>,
}

#[derive(Deserialize)]
pub struct RmOptions {
    pub recursive: Option<bool>,
    pub force: Option<bool>,
}

#[derive(Deserialize)]
#[serde(untagged)]
pub enum WriteFileData {
    Text(String),
    Bytes(Vec<u8>),
}

impl WriteFileData {
    pub fn into_bytes(self) -> Vec<u8> {
        match self {
            Self::Text(value) => value.into_bytes(),
            Self::Bytes(value) => value,
        }
    }
}

pub fn format_system_time(value: SystemTime) -> String {
    DateTime::<Utc>::from(value).to_rfc3339()
}

pub fn with_path_context(action: &str, path: &str, error: impl std::fmt::Display) -> String {
    format!("{action} failed for {path}: {error}")
}

pub fn metadata_created_or_modified(path: &str, metadata: &fs::Metadata) -> Result<String, String> {
    metadata
        .created()
        .or_else(|_| metadata.modified())
        .map(format_system_time)
        .map_err(|error| with_path_context("Reading file creation time", path, error))
}

pub fn metadata_modified(path: &str, metadata: &fs::Metadata) -> Result<String, String> {
    metadata
        .modified()
        .map(format_system_time)
        .map_err(|error| with_path_context("Reading file modified time", path, error))
}

pub fn load_image(path: &str) -> Result<DynamicImage, String> {
    ImageReader::open(path)
        .map_err(|error| with_path_context("Opening image", path, error))?
        .with_guessed_format()
        .map_err(|error| with_path_context("Guessing image format", path, error))?
        .decode()
        .map_err(|error| with_path_context("Decoding image", path, error))
}

pub fn inspect_image_header(path: &str) -> Result<ImageHeaderInfo, String> {
    let reader = ImageReader::open(path)
        .map_err(|error| with_path_context("Opening image", path, error))?
        .with_guessed_format()
        .map_err(|error| with_path_context("Guessing image format", path, error))?;
    let mime_type = mime_type_from_format(reader.format());

    let (width, height) = reader
        .into_dimensions()
        .map_err(|error| with_path_context("Reading image dimensions", path, error))?;

    Ok(ImageHeaderInfo {
        dimensions: MediaDimensions { width, height },
        mime_type,
    })
}

/// Returns a list of directories the application is allowed to access.
/// Used to scope file-system commands to safe locations.
fn allowed_dirs() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();

    // System temp directory
    dirs.push(std::env::temp_dir());

    // User home directory
    if let Some(home) = std::env::var_os("HOME") {
        dirs.push(std::path::PathBuf::from(home));
    }

    // Fallback on macOS and Linux
    if let Some(user) = std::env::var_os("USER") {
        let fallback = std::path::PathBuf::from("/home").join(user);
        if fallback.exists() {
            dirs.push(fallback);
        }
    }

    dirs
}

/// Validates that a path is within one of the allowed directories.
/// Returns `Ok(())` if the path is safe, or an error description otherwise.
pub fn validate_path_scope(path: &str) -> Result<(), String> {
    let path = std::path::Path::new(path);

    // Reject paths containing `..` to prevent directory traversal
    if path.components().any(|c| c == std::path::Component::ParentDir) {
        return Err(format!(
            "Path contains parent directory traversal: {path}",
            path = path.display()
        ));
    }

    let allowed = allowed_dirs();

    // Try canonical path first (works when the path exists)
    if let Ok(canonical) = path.canonicalize() {
        for dir in &allowed {
            if let Ok(canonical_dir) = dir.canonicalize() {
                if canonical.starts_with(&canonical_dir) {
                    return Ok(());
                }
            }
        }
    } else {
        // For non-existent paths, check against allowed dirs by prefix
        for dir in &allowed {
            if let Ok(canonical_dir) = dir.canonicalize() {
                let dir_str = canonical_dir.to_string_lossy();
                let path_str = path.to_string_lossy();
                if path_str.starts_with(dir_str.as_ref()) {
                    return Ok(());
                }
            }
        }
    }

    Err(format!(
        "Access denied: path is outside allowed directories: {path}",
        path = path.display()
    ))
}

pub fn mime_type_from_format(format: Option<ImageFormat>) -> Option<String> {
    match format {
        Some(ImageFormat::Jpeg) => Some("image/jpeg".to_string()),
        Some(ImageFormat::Png) => Some("image/png".to_string()),
        Some(ImageFormat::Gif) => Some("image/gif".to_string()),
        Some(ImageFormat::WebP) => Some("image/webp".to_string()),
        Some(ImageFormat::Bmp) => Some("image/bmp".to_string()),
        Some(ImageFormat::Tiff) => Some("image/tiff".to_string()),
        Some(ImageFormat::Avif) => Some("image/avif".to_string()),
        _ => None,
    }
}
