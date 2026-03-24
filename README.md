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

## プロジェクト構成（モノレポ）

```
packages/core/   # ドメインモデル、Zodスキーマ、リポジトリインターフェース
packages/ui/     # 共通UIコンポーネント
apps/server/     # サーバー (TanStack Start + oRPC)
apps/cli/        # CLI / MCPサーバー
xtracter/        # ブラウザ拡張機能
```

### サーバー内部構成 (`apps/server/src/`)

```
application/     # ユースケース、サービスクラス
infrastructure/  # DB、外部API、ファイルシステム実装
presentation/    # コンポーネント、ルート
```

### アーキテクチャルール (Clean Architecture)

- 依存は外→内。ドメイン層は他のどの層にも依存しない
- リポジトリは `as unknown as DomainModel` 禁止、明示的マッピング必須
- APIレスポンスは Safe DTO 経由で機密情報を除外
- DB: 全テーブルUUID (v4)、中間テーブルは `media_{entity}` 命名

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
