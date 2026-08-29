# solid-imager

AI生成画像などのメディアを管理する包括的なメディア管理システム。

## 機能

- 複数メディアソース対応（ローカル/SFTP/S3）
- メタデータ管理（プロンプト、タグ、キャラクター、IP）
- 検索・ソート・サムネイル生成
- リアルタイム更新 (SSE)
- AI自動タグ付け

## 技術スタック

```
Runtime: Bun
Framework: TanStack Start
API: oRPC
UI: Kobalte + Tailwind CSS + solid-ui
Database: PostgreSQL / PGlite
ORM: Drizzle ORM
Validation: Zod
AI/ML: dghs-imgutils-rs
Testing: Vitest / Playwright
Tooling: Vite / Biome
```

### プロジェクト構成（モノレポ）

- `apps/server/`: メインサーバー (TanStack Start + oRPC)。バックエンドAPIとWeb UIを統合。
- `apps/tauri/`: Tauri アプリ。`src/` は独立 SPA、`src-tauri/` は Rust 実装。
- `apps/cli/`: メディア管理・同期用CLIツール。
- `apps/xtracter/`: メディア収集用ブラウザ拡張機能。
- `packages/core/`: ドメインモデル、Zodスキーマ、contract、各種 port。
- `packages/application/`: ユースケース・アプリケーションサービス。
- `packages/db/`: Drizzle schema、DB repository 実装、transaction manager。
- `packages/ui/`: 共通UIコンポーネントライブラリ。
- `packages/client/`: oRPC client factory などの共有クライアント基盤。

## セットアップ

```bash
bun install
cp apps/server/.env.example apps/server/.env
sudo -E docker compose --project-directory . up -d
bun --filter @solid-imager/server run db:migrate
bun run dev
```

Aubeを使う場合は、依存関係のインストールとスクリプト実行を次のように置き換えられます。

```bash
aube i
aube -F @solid-imager/server run db:migrate
aube dev
# 本番ビルド済み成果物の起動: aube start
```

Aube用の `aube-lock.yaml` と、Bun用の `bun.lock` を併存させています。Bunで依存関係を更新した場合はAube側でも `aube i` を実行し、Aubeで依存関係を更新した場合はBun側でも `bun install` を実行して、それぞれのlockfileを同期してください。

PostgreSQLを使わずPGliteで動かす場合は、DB_HOSTを上書きしてマイグレーションを実行します。

```bash
DB_HOST=pglite bun --filter @solid-imager/server run db:migrate
```

PostgreSQL接続はBun.SQLを既定で使用します。`COPY`、`LISTEN/NOTIFY`、PostGISなどBun.SQLで未対応の機能が必要な環境では、`DB_POSTGRES_DRIVER=node-postgres` を設定すると従来の `pg` 経路へ切り替えられます。

画像処理はサムネイル変換と寸法取得を Bun.Image に寄せ、EXIF/コメント抽出と AI 用 crop は互換性のため sharp を継続利用します。

Bunランタイムの画像変換とPostgreSQL接続を個別に確認するスモークテストも用意しています。

```bash
bun run --cwd apps/server validate:bun-image
BUN_SQL_TEST_DATABASE_URL=postgres://user:password@localhost:5432/solid_imager \
  bun run --cwd apps/server validate:bun-sql
```

### AI ネイティブ依存（GPU 対応）

AI自動タグ付けに使用する `dghs-imgutils-rs` は Rust の N-API アドオンです。GPU (CUDA) を有効にする場合も、アプリケーションをビルドするホスト側のランタイムを使用します。コンテナ内で Python、Rust toolchain、ONNX Runtime、アプリケーション依存関係をセットアップする必要はありません。

```bash
ORT_PREFER_DYNAMIC_LINK=1 ORT_LIB_PATH=/usr/lib bun install
```

Aubeを使う場合も同じ環境変数を付けて実行します。

```bash
ORT_PREFER_DYNAMIC_LINK=1 ORT_LIB_PATH=/usr/lib aube i
```

要件:

- `/usr/lib/libonnxruntime.so.1` と `/usr/lib/libonnxruntime_providers_cuda.so` が存在すること
- NVIDIA ドライバーと CUDA ランタイムがインストールされていること

CPU のみで使用する場合は通常通り `bun install` してください。

### 本番コンテナ

本番の `app` コンテナは Python 3 を追加した `Dockerfile.runtime` をランタイムとして起動し、ホスト側でビルド済みのプロジェクトを `/app` にマウントします。`youtube-dl-exec` が同梱する `yt-dlp` は Python zipapp のため、Python 3 が必要です。アプリケーション依存関係の `bun install` はコンテナ内で実行しません。

ビルドホストで一度だけ実行します。

```bash
bun install --frozen-lockfile
bun run --cwd apps/server build
```

デプロイホストからその成果物が見える状態にして、`APP_ARTIFACT_DIR` にプロジェクトルートを指定します。

```bash
if [ -n "${APP_RUNTIME_IMAGE:-}" ]; then
  APP_ARTIFACT_DIR=/srv/solid-imager \
    docker compose -f compose.yml -f compose.production.yml -f compose.production.override.yml up -d --no-build
else
  docker compose -f compose.yml -f compose.production.yml build app
  APP_ARTIFACT_DIR=/srv/solid-imager \
    docker compose -f compose.yml -f compose.production.yml -f compose.production.override.yml up -d
fi
```

`APP_ARTIFACT_DIR` には `node_modules/` と `apps/server/.output/` を含む、ビルドホストのプロジェクトディレクトリを指定してください。
`APP_RUNTIME_IMAGE` を指定した場合は、Python 3 がインストール済みの互換イメージを使用してください。この場合、`app` はローカルビルドせず、指定イメージをそのまま使用します。

## 主要スクリプト

| コマンド                                            | 用途                      |
| --------------------------------------------------- | ------------------------- |
| `bun run dev`                                       | 開発サーバー起動          |
| `aube dev`                                          | Aube経由の開発サーバー起動 |
| `aube start`                                        | Aube経由の本番サーバー起動 |
| `bun run check`                                     | lint / format / typecheck |
| `bun run test`                                      | Vitest テスト             |
| `bun run format`                                    | Biomeによるformat         |
| `bun run lint`                                      | lint                      |
| `bun --filter @solid-imager/server run db:generate` | マイグレーション生成      |

## 設定ファイル

| ファイル                           | 用途                     |
| ---------------------------------- | ------------------------ |
| `packages/db/src/schema.ts`        | Drizzle DBスキーマ       |
| `apps/server/drizzle.config.ts`    | DB接続、マイグレーション |
| `biome.json`                       | Linter/Formatter         |
| `vitest.config.ts`                 | Vitest projects          |
| `apps/server/playwright.config.ts` | E2Eテスト                |
| `compose.yml`                      | PostgreSQL (Docker)      |

## 詳細

- **API仕様**: [OpenAPI](./apps/server/public/openapi.json)、[Swagger UI](./apps/server/public/api-docs.html)
- **Tauri SPA**: [`apps/tauri/src/`](./apps/tauri/src/)、Rust側 [`apps/tauri/src-tauri/`](./apps/tauri/src-tauri/)
- **V2移行状況**: [REPORT.md](./REPORT.md)
- **DBスキーマ**: `packages/db/src/schema.ts`
- **本番DB移行**: [PostgreSQL 18 / UUIDv7移行手順](./docs/operations/postgresql-18-uuidv7-migration.md)
- **開発ルール**: [AGENTS.md](./AGENTS.md)
