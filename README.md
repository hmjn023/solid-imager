# solid-imager

AI生成画像などのメディアを管理する包括的なメディア管理システム。

## 機能

- 複数メディアソース対ース対応（ローカル/SFTP/S3）
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
AI/ML: Python (FastAPI, dghs-imgutils, onnxruntime)
Testing: Vitest / Playwright
Lint: Biome
```

### プロジェクト構成（モノレポ）

- `apps/server/`: メインサーバー (TanStack Start + oRPC)。バックエンドAPIとフロントエンドUIを統合。
- `apps/cli/`: メディア管理・同期用CLIツール。
- `packages/core/`: ドメインモデル、Zodスキーマ、ビジネスロジック、各インターフェース。
- `packages/ui/`: 共通UIコンポーネントライブラリ (Kobalte + Tailwind CSS + solid-ui)。
- `xtracter/`: メディア収集用ブラウザ拡張機能。
- `src-python/`: AI解析サービス (FastAPI + dghs-imgutils)。

## セットアップ

```bash
bun install
cp apps/server/.env.example apps/server/.env
sudo -E docker compose --project-directory . up -d
bun --filter @solid-imager/server run db:migrate
bun run dev
```

## 主要スクリプト

| コマンド | 用途 |
|---|---|
| `bun run dev` | 開発サーバー起動 |
| `bun run test` | ユニットテスト |
| `bun run test:e2e` | E2Eテスト |
| `bun run lint` | リントチェック |
| `bun run db:generate` | マイグレーション生成 |

## 設定ファイル

| ファイル | 用途 |
|---|---|
| `drizzle.config.ts` | DB接続、マイグレーション |
| `biome.json` | Linter/Formatter |
| `vitest.config.ts` | ユニットテスト |
| `playwright.config.ts` | E2Eテスト |
| `compose.yml` | PostgreSQL (Docker) |

## 詳細

- **API設計**: [docs/design/api-design.md](./docs/design/api-design.md)
- **DBスキーマ**: `apps/server/src/infrastructure/db/schema.ts`
- **開発ルール**: [AGENTS.md](./AGENTS.md)
