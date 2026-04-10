use crate::backend::helpers::*;
use serde_json::{json, Value};

impl super::LocalBackend {
    pub fn handle_authors_list(&self) -> Result<Value, String> {
        let conn = self.open_connection()?;
        let mut stmt = conn
			.prepare("SELECT id, name, account_id, created_at, updated_at FROM authors ORDER BY name ASC")
			.map_err(|error| format!("Preparing authors list failed: {error}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "accountId": row.get::<_, Option<String>>(2)?,
                    "createdAt": row.get::<_, String>(3)?,
                    "updatedAt": row.get::<_, String>(4)?,
                }))
            })
            .map_err(|error| format!("Querying authors failed: {error}"))?;
        collect_json_rows(rows)
    }
}
