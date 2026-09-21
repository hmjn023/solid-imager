use std::io::ErrorKind;

use tauri::Manager;

#[tauri::command]
fn remove_sqlite_database(
	app: tauri::AppHandle,
	database_name: String,
) -> Result<(), String> {
	if !database_name.starts_with("solid-imager")
		|| !database_name.ends_with(".db")
		|| database_name.contains('/')
		|| database_name.contains('\\')
		|| database_name.contains("..")
	{
		return Err("Invalid SQLite database name.".to_string());
	}

	let config_dir = app
		.path()
		.app_config_dir()
		.map_err(|error| format!("Failed to resolve app config directory: {error}"))?;
	for suffix in ["", "-wal", "-shm"] {
		let path = config_dir.join(format!("{database_name}{suffix}"));
		match std::fs::remove_file(&path) {
			Ok(()) => {}
			Err(error) if error.kind() == ErrorKind::NotFound => {}
			Err(error) => {
				return Err(format!(
					"Failed to remove SQLite database {}: {error}",
					path.display()
				));
			}
		}
	}
	Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
	tauri::Builder::default()
		.plugin(tauri_plugin_http::init())
		.plugin(tauri_plugin_sql::Builder::new().build())
		.plugin(tauri_plugin_store::Builder::default().build())
		.invoke_handler(tauri::generate_handler![remove_sqlite_database])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
