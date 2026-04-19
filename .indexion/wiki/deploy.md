# デプロイ / 本番運用

## 構成

```
[Browser / Tauri App]
    ↓ HTTP
[apps/server]  ← TanStack Start + Nitro
    ↓ SQL
[PostgreSQL]   ← Docker Compose
    ↓ HTTP
[src-python]   ← FastAPI（AI解析、オプション）
```

## Docker Compose（PostgreSQL）

`compose.yml`（プロジェクトルート）でPostgreSQLを起動:

```bash
sudo -E docker compose --project-directory . up -d
```

データは `./db-data/` に永続化される。

## 環境変数一覧

`apps/server/.env` に配置:

| 変数 | デフォルト | 説明 |
|---|---|---|
| `DB_HOST` | `pglite` | DBホスト。`pglite` 指定でインメモリPGlite（テスト/Tauri用） |
| `DB_PORT` | `5432` | PostgreSQLポート |
| `DB_DATABASE` | `solid_imager` | DB名 |
| `DB_USER` | — | DBユーザー名 |
| `DB_PASSWORD` | — | DBパスワード |
| `API_BASE_URL` | `http://localhost:3000` | サーバーベースURL |
| `LOG_LEVEL` | — | ログレベル（`info`, `debug`, `error`等） |
| `PGLITE_DATA_DIR` | — | PGliteデータの永続化ディレクトリ |
| `NODE_ENV` | `development` | 実行環境 |

`compose.yml` でも同じ変数（`DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_PORT`）を参照するため、`.env` を共有できる。

## 起動手順（開発）

```bash
# 1. 依存関係インストール
bun install

# 2. 環境変数設定
cp apps/server/.env.example apps/server/.env
# apps/server/.env を編集（DB認証情報等）

# 3. PostgreSQL起動
sudo -E docker compose --project-directory . up -d

# 4. マイグレーション
bun --filter @solid-imager/server run db:migrate

# 5. 開発サーバー起動
bun run dev
```

## 本番ビルド

```bash
bun --filter @solid-imager/server run build
bun --filter @solid-imager/server run start
```

## Tauriデスクトップアプリ（スタンドアロン）

PostgreSQLもDockerも不要。PGliteがWasmでブラウザ内に内蔵される。

```bash
# Rust toolchainが必要（cargo）
bun --filter @solid-imager/tauri run tauri build
```

ビルド成果物は `apps/tauri/src-tauri/target/release/bundle/` に生成。

## AIサービス（オプション）

```bash
cd src-python
uv sync
uvicorn main:app --host 0.0.0.0 --port 8000
```

`apps/server/.env` に `API_BASE_URL` が設定されていればサーバーがAIサービスと連携する。未設定でもAI機能以外は動作する。

## マイグレーション運用

```bash
# スキーマ変更後にマイグレーションファイルを生成
bun --filter @solid-imager/server run db:generate

# ファイルを確認してからapply
bun --filter @solid-imager/server run db:migrate
```

マイグレーションファイルは `apps/server/drizzle/` に格納され、Tauriアプリが共有利用するため**削除・改変しない**こと。

## ログ

サーバーログは `LOG_LEVEL` 環境変数で制御。デフォルトは `info`。`infrastructure/logger.ts` にpinoベースのロガーを実装。
