use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::{Component, Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupCreateZipInput {
    pub root_path: String,
    pub dump_json: String,
    pub file_paths: Vec<String>,
    pub file_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupExtractZipInput {
    pub root_path: String,
    pub bytes: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryFilePayload {
    pub file_name: String,
    pub mime_type: String,
    pub data: Vec<u8>,
}

fn is_safe_relative_path(path: &str) -> bool {
    let candidate = Path::new(path);
    !candidate.is_absolute()
        && candidate
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn normalize_relative_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(segment) => Some(segment.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

#[tauri::command]
pub fn backup_create_zip(input: BackupCreateZipInput) -> Result<BinaryFilePayload, String> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::<u8>::new()));
    let file_options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    writer
        .start_file("dump.json", file_options)
        .map_err(|error| format!("Creating dump.json in ZIP failed: {error}"))?;
    writer
        .write_all(input.dump_json.as_bytes())
        .map_err(|error| format!("Writing dump.json failed: {error}"))?;

    let root = PathBuf::from(&input.root_path);
    for file_path in input.file_paths {
        if !is_safe_relative_path(&file_path) {
            continue;
        }

        let full_path = root.join(Path::new(&file_path));
        let mut file = match fs::File::open(&full_path) {
            Ok(file) => file,
            Err(_) => continue,
        };

        writer
            .start_file(
                format!("images/{}", file_path.replace('\\', "/")),
                file_options,
            )
            .map_err(|error| format!("Adding {file_path} to ZIP failed: {error}"))?;
        std::io::copy(&mut file, &mut writer)
            .map_err(|error| format!("Writing {file_path} to ZIP failed: {error}"))?;
    }

    let cursor = writer
        .finish()
        .map_err(|error| format!("Finalizing ZIP dump failed: {error}"))?;

    Ok(BinaryFilePayload {
        file_name: input.file_name,
        mime_type: "application/zip".to_string(),
        data: cursor.into_inner(),
    })
}

#[tauri::command]
pub fn backup_extract_zip(input: BackupExtractZipInput) -> Result<Value, String> {
    let cursor = Cursor::new(input.bytes);
    let mut archive =
        ZipArchive::new(cursor).map_err(|error| format!("Opening ZIP failed: {error}"))?;
    let root = PathBuf::from(&input.root_path);
    let mut dump_data: Option<Value> = None;

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
                serde_json::from_str::<Value>(&text)
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
        if relative_path.is_empty() || !is_safe_relative_path(&relative_path) {
            continue;
        }

        let destination = root.join(Path::new(&relative_path));
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Creating ZIP restore directory failed: {error}"))?;
        }

        let mut output = fs::File::create(&destination)
            .map_err(|error| format!("Creating restored file failed: {error}"))?;
        std::io::copy(&mut entry, &mut output)
            .map_err(|error| format!("Extracting ZIP file failed: {error}"))?;
    }

    dump_data.ok_or_else(|| "dump.json not found in ZIP".to_string())
}
