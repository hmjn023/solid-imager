use super::utils::*;
use crate::media_config::ComfyUiTagExtractionConfig;
use crate::media_metadata::extract_metadata_from_path;
use image::codecs::jpeg::JpegEncoder;
use image::ImageFormat;
use serde::Deserialize;
use std::fs::{self, File};
use std::io::BufWriter;
use std::path::Path;

#[tauri::command(async)]
pub fn image_get_dimensions(media_path: String) -> Result<MediaDimensions, String> {
    Ok(inspect_image_header(&media_path)?.dimensions)
}

fn probe_single_media(media_path: &str) -> Result<ProbeMediaResult, String> {
    let metadata = fs::metadata(media_path)
        .map_err(|error| with_path_context("Reading file metadata", media_path, error))?;
    let header = inspect_image_header(media_path).ok();
    let dimensions = header
        .as_ref()
        .map(|value| value.dimensions)
        .unwrap_or(MediaDimensions {
            width: 0,
            height: 0,
        });
    let mime_type = header.and_then(|value| value.mime_type).or_else(|| {
        mime_guess::from_path(media_path)
            .first_raw()
            .map(|value| value.to_string())
    });

    Ok(ProbeMediaResult {
        width: dimensions.width,
        height: dimensions.height,
        size: metadata.len(),
        created_at: metadata_created_or_modified(media_path, &metadata)?,
        modified_at: metadata_modified(media_path, &metadata)?,
        duration: None,
        mime_type,
        codec: None,
    })
}

#[tauri::command(async)]
pub fn probe_media(media_path: String) -> Result<ProbeMediaResult, String> {
    probe_single_media(&media_path)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeMediaBatchItemResult {
    pub media_path: String,
    pub result: Option<ProbeMediaResult>,
    pub error: Option<String>,
}

#[tauri::command(async)]
pub async fn probe_media_batch(media_paths: Vec<String>) -> Result<Vec<ProbeMediaBatchItemResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use rayon::prelude::*;
        media_paths
            .into_par_iter()
            .map(|path| {
                match probe_single_media(&path) {
                    Ok(result) => ProbeMediaBatchItemResult {
                        media_path: path,
                        result: Some(result),
                        error: None,
                    },
                    Err(error) => ProbeMediaBatchItemResult {
                        media_path: path,
                        result: None,
                        error: Some(error),
                    },
                }
            })
            .collect()
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn image_extract_metadata(media_path: String) -> Result<ExtractMetadataResult, String> {
    extract_metadata_from_path(&media_path, &ComfyUiTagExtractionConfig::default())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailRequest {
    pub media_path: String,
    pub output_path: String,
    pub size: u32,
    pub quality: u8,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailItemResult {
    pub media_path: String,
    pub error: Option<String>,
}

fn generate_single_thumbnail(req: &ThumbnailRequest) -> ThumbnailItemResult {
    let result = (|| -> Result<(), String> {
        let image = load_image(&req.media_path)?;
        let thumbnail = image.thumbnail(req.size, req.size);
        let output = Path::new(&req.output_path);

        if let Some(parent) = output.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                with_path_context("Creating thumbnail directory", &req.output_path, error)
            })?;
        }

        let extension = output
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("jpg")
            .to_ascii_lowercase();

        match extension.as_str() {
            "jpg" | "jpeg" => {
                let file = File::create(output).map_err(|error| {
                    with_path_context("Creating thumbnail file", &req.output_path, error)
                })?;
                let mut encoder = JpegEncoder::new_with_quality(BufWriter::new(file), req.quality);
                encoder.encode_image(&thumbnail).map_err(|error| {
                    with_path_context("Encoding JPEG thumbnail", &req.output_path, error)
                })
            }
            "png" => thumbnail
                .save_with_format(output, ImageFormat::Png)
                .map_err(|error| with_path_context("Saving PNG thumbnail", &req.output_path, error)),
            "webp" => thumbnail
                .save_with_format(output, ImageFormat::WebP)
                .map_err(|error| with_path_context("Saving WebP thumbnail", &req.output_path, error)),
            _ => thumbnail
                .save(output)
                .map_err(|error| with_path_context("Saving thumbnail", &req.output_path, error)),
        }
    })();

    ThumbnailItemResult {
        media_path: req.media_path.clone(),
        error: result.err(),
    }
}

#[tauri::command(async)]
pub fn image_generate_thumbnail(
    media_path: String,
    output_path: String,
    size: u32,
    quality: u8,
) -> Result<(), String> {
    generate_single_thumbnail(&ThumbnailRequest {
        media_path,
        output_path,
        size,
        quality,
    })
    .error
    .map_or(Ok(()), Err)
}

#[tauri::command(async)]
pub async fn image_generate_thumbnails_batch(
    items: Vec<ThumbnailRequest>,
) -> Result<Vec<ThumbnailItemResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use rayon::prelude::*;
        items
            .into_par_iter()
            .map(|req| generate_single_thumbnail(&req))
            .collect()
    })
    .await
    .map_err(|e| e.to_string())
}
