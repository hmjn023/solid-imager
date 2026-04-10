use crate::backend::helpers::*;
use rusqlite::Connection;

impl super::LocalBackend {
    pub fn open_connection(&self) -> Result<Connection, String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|error| format!("Opening local database failed: {error}"))?;
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
            .map_err(|error| format!("Configuring local database failed: {error}"))?;
        Ok(conn)
    }

    pub fn list_entity_ids(&self, conn: &Connection, table: &str) -> Result<Vec<String>, String> {
        let mut stmt = conn
            .prepare(&format!("SELECT id FROM {table} ORDER BY name ASC"))
            .map_err(|error| format!("Preparing entity id query failed: {error}"))?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Querying entity ids failed: {error}"))?;
        collect_typed_rows(rows)
    }
}
