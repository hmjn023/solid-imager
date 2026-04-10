use crate::backend::types::*;
use rusqlite::OptionalExtension;
use std::fs;

impl super::LocalBackend {
    pub fn initialize(&self) -> Result<(), String> {
        let conn = self.open_connection()?;
        conn.execute_batch(
            r#"
			PRAGMA foreign_keys = ON;
			PRAGMA journal_mode = WAL;

			CREATE TABLE IF NOT EXISTS media_sources (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				type TEXT NOT NULL,
				connection_info TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS medias (
				id TEXT PRIMARY KEY,
				media_source_id TEXT NOT NULL,
				file_path TEXT NOT NULL,
				file_name TEXT NOT NULL,
				media_type TEXT NOT NULL,
				width INTEGER NOT NULL,
				height INTEGER NOT NULL,
				file_size INTEGER,
				description TEXT,
				created_at TEXT NOT NULL,
				modified_at TEXT NOT NULL,
				indexed_at TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'active',
				UNIQUE(media_source_id, file_path),
				FOREIGN KEY(media_source_id) REFERENCES media_sources(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS media_urls (
				id TEXT PRIMARY KEY,
				media_id TEXT NOT NULL,
				url TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS authors (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				account_id TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS media_authors (
				media_id TEXT NOT NULL,
				author_id TEXT NOT NULL,
				PRIMARY KEY(media_id, author_id),
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE,
				FOREIGN KEY(author_id) REFERENCES authors(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS tags (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				description TEXT,
				attribute TEXT,
				color TEXT,
				source TEXT NOT NULL,
				author_id TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS media_tags (
				media_id TEXT NOT NULL,
				tag_id TEXT NOT NULL,
				type TEXT NOT NULL,
				confidence REAL,
				source TEXT NOT NULL,
				PRIMARY KEY(media_id, tag_id, type, source),
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE,
				FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS projects (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				description TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				archived_at TEXT
			);

			CREATE TABLE IF NOT EXISTS media_projects (
				media_id TEXT NOT NULL,
				project_id TEXT NOT NULL,
				PRIMARY KEY(media_id, project_id),
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE,
				FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS ips (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				description TEXT,
				source TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS media_ips (
				media_id TEXT NOT NULL,
				ip_id TEXT NOT NULL,
				confidence REAL,
				source TEXT NOT NULL,
				PRIMARY KEY(media_id, ip_id, source),
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE,
				FOREIGN KEY(ip_id) REFERENCES ips(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS characters (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
				description TEXT,
				source TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS character_ips (
				character_id TEXT NOT NULL,
				ip_id TEXT NOT NULL,
				PRIMARY KEY(character_id, ip_id),
				FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
				FOREIGN KEY(ip_id) REFERENCES ips(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS media_characters (
				media_id TEXT NOT NULL,
				character_id TEXT NOT NULL,
				confidence REAL,
				source TEXT NOT NULL,
				PRIMARY KEY(media_id, character_id, source),
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE,
				FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS generation_infos (
				media_id TEXT PRIMARY KEY,
				metadata_json TEXT,
				prompt TEXT,
				negative_prompt TEXT,
				workflow_json TEXT,
				loras_json TEXT,
				vae TEXT,
				hypernetworks_json TEXT,
				embeddings_json TEXT,
				ai_generated INTEGER NOT NULL DEFAULT 0,
				model_name TEXT NOT NULL DEFAULT '',
				seed REAL NOT NULL DEFAULT 0,
				cfg_scale REAL NOT NULL DEFAULT 0,
				steps REAL NOT NULL DEFAULT 0,
				FOREIGN KEY(media_id) REFERENCES medias(id) ON DELETE CASCADE
			);

			CREATE TABLE IF NOT EXISTS presets (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL UNIQUE,
				value_json TEXT NOT NULL,
				sort TEXT,
				order_value TEXT,
				mode TEXT,
				created_at TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS app_config (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				value_json TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);
			"#,
        )
        .map_err(|error| format!("Initializing local database failed: {error}"))?;
        self.ensure_config_storage(&conn)?;
        Ok(())
    }

    fn ensure_config_storage(&self, conn: &rusqlite::Connection) -> Result<(), String> {
        let exists = conn
            .query_row("SELECT 1 FROM app_config WHERE id = 1", [], |_row| Ok(()))
            .optional()
            .map_err(|error| format!("Checking app config storage failed: {error}"))?
            .is_some();

        if exists {
            return Ok(());
        }

        let config = if self.legacy_config_path.exists() {
            let text = fs::read_to_string(&self.legacy_config_path)
                .map_err(|error| format!("Reading legacy config file failed: {error}"))?;
            serde_json::from_str::<AppConfig>(&text)
                .map_err(|error| format!("Parsing legacy config file failed: {error}"))?
        } else {
            AppConfig::default()
        };

        let value_json = serde_json::to_string_pretty(&config)
            .map_err(|error| format!("Serializing default config failed: {error}"))?;

        conn.execute(
            "INSERT INTO app_config (id, value_json, updated_at) VALUES (1, ?1, ?2)",
            rusqlite::params![value_json, super::helpers::now_iso()],
        )
        .map_err(|error| format!("Seeding app config failed: {error}"))?;

        if self.legacy_config_path.exists() {
            let _ = fs::remove_file(&self.legacy_config_path);
        }

        Ok(())
    }
}
