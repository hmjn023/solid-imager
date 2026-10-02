use std::io::ErrorKind;

use tauri::Manager;

fn validate_x_verification_url(raw: &str) -> Result<(), String> {
	let url = reqwest::Url::parse(raw).map_err(|_| "Invalid X profile URL.".to_string())?;
	let username = url.path().strip_prefix('/').unwrap_or_default();
	let token = url
		.fragment()
		.and_then(|fragment| fragment.strip_prefix("solid-imager-account-verification="))
		.unwrap_or_default();
	if url.scheme() != "https"
		|| url.host_str() != Some("x.com")
		|| !url.username().is_empty()
		|| url.password().is_some()
		|| url.port().is_some()
		|| url.query().is_some()
		|| username.is_empty()
		|| username.len() > 15
		|| !username
			.bytes()
			.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
		|| token.len() != 36
		|| !token.bytes().enumerate().all(|(index, byte)| {
			if [8, 13, 18, 23].contains(&index) {
				byte == b'-'
			} else {
				byte.is_ascii_hexdigit()
			}
		}) {
		return Err("Only Manager X verification links can be opened.".to_string());
	}
	Ok(())
}

#[tauri::command]
async fn open_x_verification_profile(url: String) -> Result<(), String> {
	validate_x_verification_url(&url)?;
	tauri::async_runtime::spawn_blocking(move || {
		#[cfg(target_os = "windows")]
		let mut command = {
			let mut command = std::process::Command::new("rundll32");
			command.arg("url.dll,FileProtocolHandler");
			command
		};
		#[cfg(target_os = "macos")]
		let mut command = std::process::Command::new("open");
		#[cfg(not(any(target_os = "windows", target_os = "macos")))]
		let mut command = std::process::Command::new("xdg-open");
		let status = command
			.arg(url)
			.status()
			.map_err(|error| format!("Failed to open browser: {error}"))?;
		if !status.success() {
			return Err("Could not open the default browser.".to_string());
		}
		Ok(())
	})
	.await
	.map_err(|error| error.to_string())?
}

#[tauri::command]
fn remove_sqlite_database(app: tauri::AppHandle, database_name: String) -> Result<(), String> {
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
		.invoke_handler(tauri::generate_handler![
			remove_sqlite_database,
			open_x_verification_profile
		])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
	use super::validate_x_verification_url;
	#[test]
	fn only_manager_x_profile_links_are_accepted() {
		let fragment = "#solid-imager-account-verification=12345678-1234-4123-8123-123456789abc";
		assert!(
			validate_x_verification_url(&format!("https://x.com/current_name{fragment}")).is_ok()
		);
		for prefix in [
			"https://example.com/current_name",
			"file:///tmp/test",
			"https://x.com/current/name",
			"https://x.com/current_name?extra=1",
			"https://x.com/a&b",
		] {
			assert!(validate_x_verification_url(&format!("{prefix}{fragment}")).is_err());
		}
		assert!(validate_x_verification_url("https://x.com/current_name").is_err());
	}
}
