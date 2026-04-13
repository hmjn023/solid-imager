use crate::backend::helpers::*;
use crate::backend::types::*;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use uuid::Uuid;

impl super::LocalBackend {
    pub fn handle_projects_list(&self) -> Result<Value, String> {
        let conn = self.open_connection()?;
        let mut stmt = conn
			.prepare(
				"SELECT id, name, description, created_at, updated_at, archived_at FROM projects ORDER BY name ASC",
			)
			.map_err(|error| format!("Preparing projects list failed: {error}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "createdAt": row.get::<_, String>(3)?,
                    "updatedAt": row.get::<_, String>(4)?,
                    "archivedAt": row.get::<_, Option<String>>(5)?,
                }))
            })
            .map_err(|error| format!("Querying projects failed: {error}"))?;
        collect_json_rows(rows)
    }

    pub fn handle_project_create(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: ProjectMutationInput = parse_input(input)?;
        let name = payload
            .name
            .ok_or_else(|| "Project name is required".to_string())?;
        let conn = self.open_connection()?;
        let id = Uuid::new_v4().to_string();
        let now = now_iso();
        conn.execute(
			"INSERT INTO projects (id, name, description, created_at, updated_at, archived_at) VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
			params![id, name, payload.description, now, now],
		)
		.map_err(|error| format!("Creating project failed: {error}"))?;
        self.find_project_value(&conn, &id)?
            .ok_or_else(|| "Created project could not be loaded".to_string())
    }

    pub fn handle_project_update(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: Value = input.ok_or_else(|| "Missing project update payload".to_string())?;
        let id = payload
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "Project id is required".to_string())?;
        let data = payload.get("data").cloned().unwrap_or_else(|| json!({}));
        let conn = self.open_connection()?;
        let mut current = self
            .find_project_value(&conn, id)?
            .ok_or_else(|| format!("Project not found: {id}"))?;
        merge_json(&mut current, &data);
        conn.execute(
			"UPDATE projects SET name = ?1, description = ?2, archived_at = ?3, updated_at = ?4 WHERE id = ?5",
			params![
				current.get("name").and_then(Value::as_str).unwrap_or_default(),
				current.get("description").and_then(Value::as_str),
				current.get("archivedAt").and_then(Value::as_str),
				now_iso(),
				id,
			],
		)
		.map_err(|error| format!("Updating project failed: {error}"))?;
        self.find_project_value(&conn, id)?
            .ok_or_else(|| "Updated project could not be loaded".to_string())
    }

    pub fn handle_project_delete(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: IdInput = parse_input(input)?;
        let conn = self.open_connection()?;
        conn.execute("DELETE FROM projects WHERE id = ?1", params![payload.id])
            .map_err(|error| format!("Deleting project failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn handle_projects_for_media(&self, input: Option<Value>) -> Result<Value, String> {
        let payload = parse_media_only_input(input)?;
        let conn = self.open_connection()?;
        self.list_projects_for_media_value(&conn, &payload)
    }

    pub fn handle_project_add_to_media(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: MediaAssociationInput = parse_input(input)?;
        let project_id = payload
            .project_id
            .ok_or_else(|| "projectId is required".to_string())?;
        let conn = self.open_connection()?;
        conn.execute(
            "INSERT OR IGNORE INTO media_projects (media_id, project_id) VALUES (?1, ?2)",
            params![payload.media_id, project_id],
        )
        .map_err(|error| format!("Adding project to media failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn handle_project_remove_from_media(&self, input: Option<Value>) -> Result<Value, String> {
        let payload: MediaAssociationInput = parse_input(input)?;
        let project_id = payload
            .project_id
            .ok_or_else(|| "projectId is required".to_string())?;
        let conn = self.open_connection()?;
        conn.execute(
            "DELETE FROM media_projects WHERE media_id = ?1 AND project_id = ?2",
            params![payload.media_id, project_id],
        )
        .map_err(|error| format!("Removing project from media failed: {error}"))?;
        Ok(json!({ "success": true }))
    }

    pub fn find_project_value(&self, conn: &Connection, id: &str) -> Result<Option<Value>, String> {
        conn
			.query_row(
				"SELECT id, name, description, created_at, updated_at, archived_at FROM projects WHERE id = ?1",
				params![id],
				|row| {
					Ok(json!({
						"id": row.get::<_, String>(0)?,
						"name": row.get::<_, String>(1)?,
						"description": row.get::<_, Option<String>>(2)?,
						"createdAt": row.get::<_, String>(3)?,
						"updatedAt": row.get::<_, String>(4)?,
						"archivedAt": row.get::<_, Option<String>>(5)?,
					}))
				},
			)
			.optional()
			.map_err(|error| format!("Looking up project failed: {error}"))
    }
}
