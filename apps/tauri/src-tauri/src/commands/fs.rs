use super::utils::*;
use futures_util::StreamExt;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command(async)]
pub fn fs_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command(async)]
pub fn fs_read_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|error| with_path_context("Reading file", &path, error))
}

#[tauri::command(async)]
pub fn fs_read_text_file(path: String, encoding: Option<String>) -> Result<String, String> {
    let encoding = encoding.unwrap_or_else(|| "utf-8".to_string());
    if encoding != "utf-8" {
        return Err(format!("Unsupported encoding: {encoding}"));
    }

    fs::read_to_string(&path).map_err(|error| with_path_context("Reading text file", &path, error))
}

#[tauri::command(async)]
pub fn fs_write_file(path: String, data: WriteFileData) -> Result<(), String> {
    fs::write(&path, data.into_bytes())
        .map_err(|error| with_path_context("Writing file", &path, error))
}

#[tauri::command(async)]
pub fn fs_mkdir(path: String, options: Option<MkdirOptions>) -> Result<(), String> {
    let recursive = options.and_then(|value| value.recursive).unwrap_or(false);

    if recursive {
        fs::create_dir_all(&path)
            .map_err(|error| with_path_context("Creating directory tree", &path, error))
    } else {
        fs::create_dir(&path).map_err(|error| with_path_context("Creating directory", &path, error))
    }
}

#[tauri::command(async)]
pub fn fs_readdir(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&path)
        .map_err(|error| with_path_context("Reading directory", &path, error))?;

    let mut names = Vec::new();
    for entry in entries {
        let entry =
            entry.map_err(|error| with_path_context("Reading directory entry", &path, error))?;
        names.push(entry.file_name().to_string_lossy().into_owned());
    }

    Ok(names)
}

#[tauri::command(async)]
pub fn fs_stat(path: String) -> Result<TauriFileStat, String> {
    let metadata = fs::metadata(&path)
        .map_err(|error| with_path_context("Reading file metadata", &path, error))?;

    Ok(TauriFileStat {
        size: metadata.len(),
        mtime: metadata_modified(&path, &metadata)?,
        birthtime: metadata_created_or_modified(&path, &metadata)?,
        is_directory: metadata.is_dir(),
    })
}

#[tauri::command(async)]
pub fn fs_unlink(path: String) -> Result<(), String> {
    fs::remove_file(&path).map_err(|error| with_path_context("Removing file", &path, error))
}

#[tauri::command(async)]
pub fn fs_rm(path: String, options: Option<RmOptions>) -> Result<(), String> {
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

#[tauri::command(async)]
pub fn fs_copy_file(src: String, dest: String) -> Result<(), String> {
    fs::copy(&src, &dest)
        .map(|_| ())
        .map_err(|error| with_path_context("Copying file", &src, error))
}

#[tauri::command(async)]
pub fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path)
        .map_err(|error| with_path_context("Renaming path", &old_path, error))
}

#[tauri::command(async)]
pub fn fs_mkdtemp(prefix: String) -> Result<String, String> {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Creating temp directory timestamp failed: {error}"))?
        .as_nanos();
    let path = std::env::temp_dir().join(format!("{prefix}{unique}"));

    fs::create_dir_all(&path).map_err(|error| {
        with_path_context(
            "Creating temporary directory",
            &path.to_string_lossy(),
            error,
        )
    })?;

    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command(async)]
pub async fn download_file(
    url: String,
    dest_path: String,
    headers: Option<Vec<(String, String)>>,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let mut request = client.get(&url);
    if let Some(hdrs) = headers {
        for (key, value) in hdrs {
            request = request.header(&key, &value);
        }
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let mut file = std::fs::File::create(&dest_path)
        .map_err(|e| with_path_context("Creating file for download", &dest_path, e))?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download stream error: {e}"))?;
        use std::io::Write;
        file.write_all(&chunk)
            .map_err(|e| with_path_context("Writing download chunk", &dest_path, e))?;
    }

    Ok(())
}
