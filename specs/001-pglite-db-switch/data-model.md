# Data Model: DB Pglite切り替え機能

## Entity: Database Configuration

**Description**: データベース接続情報とタイプ（pgliteまたはDocker Compose PostgreSQL）を保持する専用の設定ファイル。

**Attributes**:
- `type`: String (Enum: 'pglite', 'docker-compose-postgres'). Specifies the type of database to use.
- `connection_details`: Object. Contains connection parameters specific to the `type`.
    - For `pglite`:
        - `path`: String. File path for pglite storage (if file-based).
        - `in_memory`: Boolean. Whether pglite runs in-memory.
    - For `docker-compose-postgres`:
        - `host`: String. PostgreSQL host.
        - `port`: Integer. PostgreSQL port.
        - `user`: String. Database user.
        - `password`: String. Database password.
        - `database`: String. Database name.

**Relationships**:
- None directly within this feature, but implicitly relates to the application's database connection logic.

**Validation Rules**:
- `type` must be one of 'pglite' or 'docker-compose-postgres'.
- `connection_details` must contain all required fields for the specified `type`.
