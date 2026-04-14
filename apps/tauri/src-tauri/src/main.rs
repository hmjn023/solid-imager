mod commands;
mod media_config;
mod media_metadata;

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
            commands::backup::backup_create_zip,
            commands::backup::backup_extract_zip,
            commands::fs::fs_exists,
            commands::fs::fs_read_file,
            commands::fs::fs_read_text_file,
            commands::fs::fs_write_file,
            commands::fs::fs_mkdir,
            commands::fs::fs_readdir,
            commands::fs::fs_stat,
            commands::fs::fs_unlink,
            commands::fs::fs_rm,
            commands::fs::fs_copy_file,
            commands::fs::fs_rename,
            commands::fs::fs_mkdtemp,
            commands::media::image_generate_thumbnail,
            commands::media::image_extract_metadata,
            commands::media::image_get_dimensions,
            commands::media::probe_media
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri application")
}
