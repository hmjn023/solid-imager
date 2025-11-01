# Quickstart: DB Pglite切り替え機能

このドキュメントは、開発環境でpgliteとDocker Compose PostgreSQLを切り替えるための手順を説明します。

## 1. データベース設定ファイルの準備

アプリケーションは、専用の設定ファイルを通じてデータベースタイプを切り替えます。このファイルは、プロジェクトのルートディレクトリに配置されることを想定しています。

### pgliteを使用する場合

pgliteを使用するには、設定ファイルに以下のような記述を含めます。

```json
{
  "databaseType": "pglite",
  "pglite": {
    "path": "./data/pglite",
    "inMemory": false
  }
}
```

*   `databaseType`: `pglite`に設定します。
*   `pglite.path`: pgliteのデータが保存されるファイルパスを指定します。
*   `pglite.inMemory`: `true`に設定するとインメモリデータベースとして動作し、`false`に設定すると指定されたパスにデータを永続化します。

### Docker Compose PostgreSQLを使用する場合

Docker Composeで起動したPostgreSQLを使用するには、設定ファイルに以下のような記述を含めます。

```json
{
  "databaseType": "docker-compose-postgres",
  "dockerComposePostgres": {
    "host": "localhost",
    "port": 5432,
    "user": "user",
    "password": "password",
    "database": "mydatabase"
  }
}
```

*   `databaseType`: `docker-compose-postgres`に設定します。
*   `dockerComposePostgres`以下の項目は、Docker Composeで設定されたPostgreSQLの接続情報に合わせて変更してください。

## 2. アプリケーションの起動

設定ファイルを準備した後、通常通りアプリケーションを起動します。

```bash
bun run dev
```

## 3. データベースの切り替え

データベースを切り替えるには、上記の手順に従って設定ファイルを編集し、アプリケーションを再起動してください。
