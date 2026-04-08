use std::fs::{self, File};
use std::io::BufWriter;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::{DateTime, Utc};
use image::codecs::jpeg::JpegEncoder;
use image::{DynamicImage, ImageFormat, ImageReader};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeMediaResult {
	width: u32,
	height: u32,
	size: u64,
	created_at: String,
	modified_at: String,
	duration: Option<f64>,
	mime_type: Option<String>,
	codec: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TauriFileStat {
	size: u64,
	mtime: String,
	birthtime: String,
	is_directory: bool,
}

#[derive(Serialize)]
struct ExtractedTag {
	name: String,
	#[serde(rename = "type")]
	tag_type: &'static str,
}

#[derive(Serialize)]
struct ExtractMetadataResult {
	tags: Vec<ExtractedTag>,
	prompt: Option<Value>,
	workflow: Option<Value>,
}

#[derive(Serialize, Clone, Copy)]
struct MediaDimensions {
	width: u32,
	height: u32,
}

struct ImageHeaderInfo {
	dimensions: MediaDimensions,
	mime_type: Option<String>,
}

#[derive(Deserialize)]
struct MkdirOptions {
	recursive: Option<bool>,
}

#[derive(Deserialize)]
struct RmOptions {
	recursive: Option<bool>,
	force: Option<bool>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum WriteFileData {
	Text(String),
	Bytes(Vec<u8>),
}

impl WriteFileData {
	fn into_bytes(self) -> Vec<u8> {
		match self {
			Self::Text(value) => value.into_bytes(),
			Self::Bytes(value) => value,
		}
	}
}

fn format_system_time(value: SystemTime) -> String {
	DateTime::<Utc>::from(value).to_rfc3339()
}

fn with_path_context(action: &str, path: &str, error: impl std::fmt::Display) -> String {
	format!("{action} failed for {path}: {error}")
}

fn metadata_created_or_modified(path: &str, metadata: &fs::Metadata) -> Result<String, String> {
	metadata
		.created()
		.or_else(|_| metadata.modified())
		.map(format_system_time)
		.map_err(|error| with_path_context("Reading file creation time", path, error))
}

fn metadata_modified(path: &str, metadata: &fs::Metadata) -> Result<String, String> {
	metadata
		.modified()
		.map(format_system_time)
		.map_err(|error| with_path_context("Reading file modified time", path, error))
}

fn load_image(path: &str) -> Result<DynamicImage, String> {
	ImageReader::open(path)
		.map_err(|error| with_path_context("Opening image", path, error))?
		.with_guessed_format()
		.map_err(|error| with_path_context("Guessing image format", path, error))?
		.decode()
		.map_err(|error| with_path_context("Decoding image", path, error))
}

fn inspect_image_header(path: &str) -> Result<ImageHeaderInfo, String> {
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

fn get_dimensions_from_header(path: &str) -> Result<MediaDimensions, String> {
	Ok(inspect_image_header(path)?.dimensions)
}

fn mime_type_from_format(format: Option<ImageFormat>) -> Option<String> {
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

#[tauri::command]
fn fs_exists(path: String) -> bool {
	Path::new(&path).exists()
}

#[tauri::command]
fn fs_read_file(path: String) -> Result<Vec<u8>, String> {
	fs::read(&path).map_err(|error| with_path_context("Reading file", &path, error))
}

#[tauri::command]
fn fs_read_text_file(path: String, encoding: Option<String>) -> Result<String, String> {
	let encoding = encoding.unwrap_or_else(|| "utf-8".to_string());
	if encoding != "utf-8" {
		return Err(format!("Unsupported encoding: {encoding}"));
	}

	fs::read_to_string(&path)
		.map_err(|error| with_path_context("Reading text file", &path, error))
}

#[tauri::command]
fn fs_write_file(path: String, data: WriteFileData) -> Result<(), String> {
	fs::write(&path, data.into_bytes())
		.map_err(|error| with_path_context("Writing file", &path, error))
}

#[tauri::command]
fn fs_mkdir(path: String, options: Option<MkdirOptions>) -> Result<(), String> {
	let recursive = options.and_then(|value| value.recursive).unwrap_or(false);

	if recursive {
		fs::create_dir_all(&path)
			.map_err(|error| with_path_context("Creating directory tree", &path, error))
	} else {
		fs::create_dir(&path).map_err(|error| with_path_context("Creating directory", &path, error))
	}
}

#[tauri::command]
fn fs_readdir(path: String) -> Result<Vec<String>, String> {
	let entries = fs::read_dir(&path)
		.map_err(|error| with_path_context("Reading directory", &path, error))?;

	let mut names = Vec::new();
	for entry in entries {
		let entry = entry.map_err(|error| with_path_context("Reading directory entry", &path, error))?;
		names.push(entry.file_name().to_string_lossy().into_owned());
	}

	Ok(names)
}

#[tauri::command]
fn fs_stat(path: String) -> Result<TauriFileStat, String> {
	let metadata = fs::metadata(&path)
		.map_err(|error| with_path_context("Reading file metadata", &path, error))?;

	Ok(TauriFileStat {
		size: metadata.len(),
		mtime: metadata_modified(&path, &metadata)?,
		birthtime: metadata_created_or_modified(&path, &metadata)?,
		is_directory: metadata.is_dir(),
	})
}

#[tauri::command]
fn fs_unlink(path: String) -> Result<(), String> {
	fs::remove_file(&path).map_err(|error| with_path_context("Removing file", &path, error))
}

#[tauri::command]
fn fs_rm(path: String, options: Option<RmOptions>) -> Result<(), String> {
	let recursive = options
		.as_ref()
		.and_then(|value| value.recursive)
		.unwrap_or(false);
	let force = options
		.as_ref()
		.and_then(|value| value.force)
		.unwrap_or(false);
	let target = Path::new(&path);

	if !target.exists() {
		return if force {
			Ok(())
		} else {
			Err(format!("Path does not exist: {path}"))
		};
	}

	let result = if target.is_dir() {
		if recursive {
			fs::remove_dir_all(target)
		} else {
			fs::remove_dir(target)
		}
	} else {
		fs::remove_file(target)
	};

	result.map_err(|error| with_path_context("Removing path", &path, error))
}

#[tauri::command]
fn fs_copy_file(src: String, dest: String) -> Result<(), String> {
	fs::copy(&src, &dest)
		.map(|_| ())
		.map_err(|error| with_path_context("Copying file", &src, error))
}

#[tauri::command]
fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
	fs::rename(&old_path, &new_path)
		.map_err(|error| with_path_context("Renaming path", &old_path, error))
}

#[tauri::command]
fn fs_mkdtemp(prefix: String) -> Result<String, String> {
	let unique = SystemTime::now()
		.duration_since(UNIX_EPOCH)
		.map_err(|error| format!("Creating temp directory timestamp failed: {error}"))?
		.as_nanos();
	let path = std::env::temp_dir().join(format!("{prefix}{unique}"));

	fs::create_dir_all(&path).map_err(|error| {
		with_path_context("Creating temporary directory", &path.to_string_lossy(), error)
	})?;

	Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn image_get_dimensions(media_path: String) -> Result<MediaDimensions, String> {
	get_dimensions_from_header(&media_path)
}

#[tauri::command]
fn probe_media(media_path: String) -> Result<ProbeMediaResult, String> {
	let metadata = fs::metadata(&media_path)
		.map_err(|error| with_path_context("Reading file metadata", &media_path, error))?;
	let header = inspect_image_header(&media_path).ok();
	let dimensions = header
		.as_ref()
		.map(|value| value.dimensions)
		.unwrap_or(MediaDimensions {
		width: 0,
		height: 0,
	});
	let mime_type = header
		.and_then(|value| value.mime_type)
		.or_else(|| mime_guess::from_path(&media_path).first_raw().map(|value| value.to_string()));

	Ok(ProbeMediaResult {
		width: dimensions.width,
		height: dimensions.height,
		size: metadata.len(),
		created_at: metadata_created_or_modified(&media_path, &metadata)?,
		modified_at: metadata_modified(&media_path, &metadata)?,
		duration: None,
		mime_type,
		codec: None,
	})
}

#[tauri::command]
fn image_extract_metadata(_media_path: String) -> ExtractMetadataResult {
	ExtractMetadataResult {
		tags: Vec::new(),
		prompt: None,
		workflow: None,
	}
}

#[tauri::command]
fn image_generate_thumbnail(
	media_path: String,
	output_path: String,
	size: u32,
	quality: u8,
) -> Result<(), String> {
	let image = load_image(&media_path)?;
	let thumbnail = image.thumbnail(size, size);
	let output = Path::new(&output_path);

	if let Some(parent) = output.parent() {
		fs::create_dir_all(parent).map_err(|error| {
			with_path_context("Creating thumbnail directory", &output_path, error)
		})?;
	}

	let extension = output
		.extension()
		.and_then(|value| value.to_str())
		.unwrap_or("jpg")
		.to_ascii_lowercase();

	match extension.as_str() {
		"jpg" | "jpeg" => {
			let file = File::create(output)
				.map_err(|error| with_path_context("Creating thumbnail file", &output_path, error))?;
			let mut encoder = JpegEncoder::new_with_quality(BufWriter::new(file), quality);
			encoder
				.encode_image(&thumbnail)
				.map_err(|error| with_path_context("Encoding JPEG thumbnail", &output_path, error))
		}
		"png" => thumbnail
			.save_with_format(output, ImageFormat::Png)
			.map_err(|error| with_path_context("Saving PNG thumbnail", &output_path, error)),
		"webp" => thumbnail
			.save_with_format(output, ImageFormat::WebP)
			.map_err(|error| with_path_context("Saving WebP thumbnail", &output_path, error)),
		_ => thumbnail
			.save(output)
			.map_err(|error| with_path_context("Saving thumbnail", &output_path, error)),
	}
}

#[tauri::command]
fn api_call(procedure: String, _input: Option<Value>) -> Result<Value, String> {
	Err(format!("Unsupported Tauri API procedure: {procedure}"))
}

#[cfg(target_os = "linux")]
fn configure_linux_webview_environment() {
	if std::env::var_os("WAYLAND_DISPLAY").is_some()
		&& std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none()
	{
		std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
	}
}

#[cfg(not(target_os = "linux"))]
fn configure_linux_webview_environment() {}

fn main() {
	configure_linux_webview_environment();

	tauri::Builder::default()
		.invoke_handler(tauri::generate_handler![
			api_call,
			fs_exists,
			fs_read_file,
			fs_read_text_file,
			fs_write_file,
			fs_mkdir,
			fs_readdir,
			fs_stat,
			fs_unlink,
			fs_rm,
			fs_copy_file,
			fs_rename,
			fs_mkdtemp,
			image_generate_thumbnail,
			image_extract_metadata,
			image_get_dimensions,
			probe_media
		])
		.run(tauri::generate_context!())
		.expect("failed to run tauri application")
}
