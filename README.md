# solid-imager

AI生成画像などのメディアを管理する包括的なメディア管理システム。

## 機能

- 複数メディアソース対応（ローカル/SFTP/S3）
- メタデータ管理（プロンプト、タグ、キャラクター、IP）
- 検索・ソート・サムネイル生成
- リアルタイム更新 (SSE)
- AI自動タグ付け
- EmbeddingGemma 2 による画像の類似検索・日本語の自然言語検索

### MCP からメディアを操作する

HTTP MCP はデータ操作、ブラウザの WebMCP はユーザーと同じ画面を使う操作を提供します。HTTP MCP のツールは次の6つです。

| ツール | 操作 |
| --- | --- |
| `list_sources` | ソース一覧を取得します。登録前にローカルパスの重複を確認できます。 |
| `create_local_source` | サーバー上のディレクトリを `name`、`path`、任意の `description` で登録し、初回スキャンと監視を開始します。 |
| `search_media` | キーワード・タグ・ソースで検索します。`limit` と `offset` でページを取得できます。 |
| `get_media_details` | 検索結果の `mediaSourceId` を `sourceId`、`id` を `mediaId` に渡すと、メディアの基本情報、生成パラメーター、作者、キャラクター、作品（IP）、タグを取得できます。 |
| `find_tags` | 既存タグを名前で部分一致検索し、編集に必要なタグ ID を取得します。 |
| `edit_media_tags` | 1件のメディアに対して `action`（`add` または `remove`）と `tagIds` を指定します。追加は positive タグ、解除は指定 ID のすべての割り当てが対象です。 |

**HTTP MCP** — MCP クライアントの接続方式に Streamable HTTP を選び、起動中の Web サーバーの URL に `/api/mcp` を付けます。本番サーバーをローカルのポート 3000 で起動した場合は `http://localhost:3000/api/mcp` です。既定ではループバックのホスト名を許可します。リバースプロキシ経由で使う場合は、サーバーの環境変数 `MCP_ALLOWED_HOSTS` に公開ホスト名を設定し、Web UI と同じアクセス制御を適用してください。

**WebMCP** — 対応ブラウザで HTTPS または localhost の Web UI を開くと、ツールがそのタブに登録されます。Chrome で試すには `chrome://flags/#enable-webmcp-testing` を有効にして再起動してください。[Chrome の WebMCP ガイド](https://developer.chrome.com/docs/ai/webmcp)

- `search_media`: 検索画面に移動し、キーワード・タグ・ソースの条件と結果を表示します。既存の検索条件を置き換え、検索履歴として「戻る」や再読み込みで復元できます。
- `open_media`: HTTP の `get_media_details` に相当する画面操作です。対象画像とメタデータを開きます。
- `edit_media_tags`: 対象画像を開いて編集し、画面上のタグが更新されてから完了します。
- `get_current_view`: 表示中の画像、検索結果、選択状態を確認します。`limit`（最大5件）と `offset` で取得し、`next_offset` があれば次のページを取得できます。
- `find_tags`、`list_sources`、`create_local_source` も利用できます。検索・一覧の応答は短いページ単位です。

WebMCP の操作は開始・完了・失敗を通知します。ダイアログや Settings を開いている場合、画面を切り替える操作は編集を保護するため実行せず理由を返します。HTTP MCP は画面を遷移させません。

ツールの入出力は [oRPC の共有契約](./packages/core/src/domain/contract/media-tools.contract.ts) で定義します。HTTP MCP は [専用ルーター](./apps/server/src/infrastructure/api/routers/media-tools-router.ts) のみを登録し、WebMCP は同じ契約を使ってデータを操作します。画面遷移、選択状態、操作通知はブラウザー側が担当します。

### EmbeddingGemma 2 検索

1. `bun run --cwd apps/server db:migrate` を適用し、Manager → Vector extraction で **EmbeddingGemma 2** を選んでローカル画像の索引を作成します。
2. 検索バーに `text:赤い服のキャラクター` と入力して Enter を押すか、フィルター内「自然言語検索」に文章を入力します。画像詳細の More actions → Find similar (EmbeddingGemma 2) からは画像を基準に検索できます。Web と Tauri で共通です。
3. 新規登録画像も自動で索引化する場合は、Settings → Jobs の **Enable Auto EmbeddingGemma 2 Extraction** を有効にします（初期値は無効）。

画像と検索文は dghs の Q8・768 次元モデルで符号化し、専用ワーカーで実行します。推論先は全モデル共通の Settings → AI Service の Provider / Device 設定に従い、GPU も同じ設定を使います。Q8 はモデルの重み形式で、CPU/GPU の選択とは独立しています。初回はモデルがダウンロードされます。AI のリモート URL を設定している場合は、同じ API に対応したサーバーへ推論を委譲し、推論サーバー側の共通 Provider / Device 設定を使います。検索にはソースと結果件数を適用し、通常のタグ・ファイル名条件は適用しません。索引作成後に更新された画像は、再抽出されるまで検索結果から除外します。CCIP の索引とは独立しています。

## 技術スタック

```
Runtime: Bun
Framework: TanStack Start
API: oRPC v2
UI: Kobalte + Tailwind CSS + solid-ui
Database: PostgreSQL / PGlite
ORM: Drizzle ORM
Validation: Zod
AI/ML: dghs-imgutils-rs
Testing: Vitest / Playwright
Tooling: Vite / Oxlint / Oxfmt
```

### プロジェクト構成（モノレポ）

- `apps/server/`: メインサーバー (TanStack Start + oRPC)。バックエンドAPIとWeb UIを統合。
- `apps/tauri/`: Tauri アプリ。`src/` はWebと共通のワークスペース部品を使う独立 SPA、`src-tauri/` は Rust 実装。
- `apps/cli/`: メディア管理・同期用CLIツール。
- `apps/xtracter/`: メディア収集用ブラウザ拡張機能。
- `packages/core/`: ドメインモデル、Zodスキーマ、contract、各種 port。
- `packages/application/`: ユースケース・アプリケーションサービス。
- `packages/db/`: Drizzle schema、DB repository 実装、transaction manager。
- `packages/ui/`: 共通UIコンポーネントライブラリ。
- `packages/client/`: oRPC client factory などの共有クライアント基盤。

oRPC は全クライアントとサーバーで `2.0.0-beta.48` に固定しています。[v1 と v2 の RPC 通信形式は非互換](https://orpc.dev/docs/migrations/from-v1)です。更新時は Web とサーバー、Tauri、CLI、xtracter、およびリモート推論先の Solid Imager を同じリリースに揃えてください。

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

Aubeで全workspaceの依存関係を更新する場合は、root packageだけを対象にする
`aube upgrade` を直接実行せず、次のコマンドを使用してください。

```bash
bun run deps:update:aube
# equivalent: aube update -r
```

`-r` を省略すると、Aube 2.2.0では共有 `aube-lock.yaml` からworkspaceの
importerが削除され、依存関係を解決できなくなります。通常のインストールは
引き続き `aube i` を使用します。Bun側の依存関係を更新した場合は
`bun.lock` も合わせて更新してください。

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
| `bun run --cwd apps/server test:e2e:components`       | DB不要のコンポーネント検証 |
| `bun run --cwd apps/server test:e2e`                  | dev代表14件＋本番全97件のアプリE2E |
| `bun run --cwd apps/server test:e2e:full`             | dev・本番とも全件のアプリE2E |
| `bun run format`                                    | Oxfmtによるformat         |
| `bun run lint`                                      | lint                      |
| `bun --filter @solid-imager/server run db:generate` | マイグレーション生成      |

## 設定ファイル

| ファイル                           | 用途                     |
| ---------------------------------- | ------------------------ |
| `packages/db/src/schema.ts`        | Drizzle DBスキーマ       |
| `apps/server/drizzle.config.ts`    | DB接続、マイグレーション |
| `.oxlintrc.json` / `.oxfmtrc.json` | Linter/Formatter         |
| `vitest.config.ts`                 | Vitest projects          |
| `apps/server/playwright.config.ts` | E2Eテスト                |
| `compose.yml`                      | PostgreSQL (Docker)      |

## 詳細

- **テストの棚卸し・実行方針**: [テスト棚卸し](./docs/testing-audit.md)
- **API 仕様と実行**: 起動中のサーバーの `/docs/scalar`（Web・Tauri の「API Docs」）で操作を選び、**Test Request → Send** から実行できます。[OpenAPI 仕様](./apps/server/public/openapi.json) は `/openapi.json` で配信し、REST の接続先は `/api/rest` です。たとえば `curl -X POST http://localhost:3000/api/rest/sources/list` でソース一覧を取得できます。アプリ・CLI・拡張機能の型付きクライアントは `/api/rpc` を使用します。メディア本体は `GET /api/sources/{sourceId}/{mediaId}` で取得します。
- **Tauri SPA**: [`apps/tauri/src/`](./apps/tauri/src/)、Rust側 [`apps/tauri/src-tauri/`](./apps/tauri/src-tauri/)
- **UI実装状況**: [REPORT.md](./REPORT.md)（Web / Tauriの共有画面）
- **DBスキーマ**: `packages/db/src/schema.ts`
- **本番DB移行**: [PostgreSQL 18 / UUIDv7移行手順](./docs/operations/postgresql-18-uuidv7-migration.md)
- **開発ルール**: [AGENTS.md](./AGENTS.md)

### リバースプロキシ経由での API 公開

リバースプロキシが `/imager/` を取り除いて転送する場合、Scalar は `/imager/docs/scalar` から `/imager/openapi.json` を読み、`/imager/api/rest` に送信します。TLS をプロキシで終端する場合は、サーバーに `REST_PUBLIC_ORIGIN=https://imager.example.com` のように公開 Origin を設定してください。設定値にはパスを含めません。

`/api/rest` と `/api/rpc` は削除や設定変更も実行できます。外部公開時は両方をリバースプロキシなどの認証・アクセス制御で保護してください。REST の Origin 検証はブラウザーのクロスサイト送信を防ぐためのもので、利用者の認証は行いません。
