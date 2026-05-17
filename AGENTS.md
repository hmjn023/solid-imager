# AGENTS.md - solid-imager

## プロジェクト概要

このプロジェクトは、AIによって生成された画像などのメディアを管理する包括的なメディア管理システムです。ファイルの整理、検索、配信を行うためのバックエンドAPIとWebフロントエンドを提供します。

## 主要ドキュメント

- **API設計:** [./docs/design/api-design.md](./docs/design/api-design.md) (詳細はSwagger UIを参照)
- **DBスキーマ:** `apps/server/src/infrastructure/db/schema.ts`

## 開発ルール & 内部構成

### プロジェクト構成

- **`apps/server`**: `@solid-imager/server` (SolidStart + oRPC)
- **`apps/cli`**: `@solid-imager/cli` (Bun compileによるシングルバイナリ)
- **`packages/core`**: `@solid-imager/core` (ドメインモデル、Zodスキーマ、リポジトリIF)
- **`packages/ui`**: `@solid-imager/ui` (Shared UI Components)
- **`xtracter`**: ブラウザ拡張機能
- **`src-python`**: AI/ML サービス (FastAPI)

### サーバー内部構成 (`apps/server/src/`)

- `application/`: アプリケーションサービス、ユースケース、レジストリ。
- `infrastructure/`: DB (Drizzle), API実装, File System, AI連携, Job Queue。
- `presentation/`: ルート定義, グローバルストア。
- `components/`, `routes/`, `hooks/`: UIおよびルーティング関連。

### コア内部構成 (`packages/core/src/domain/`)

- ドメインごとにディレクトリを分離（`media`, `tags`, `characters`, `ips`, `authors` 等）。
- 各ドメイン配下に `schemas.ts` を配置し、Zodスキーマを定義する。

### アーキテクチャルール (Clean Architecture)

- **依存方向:** `infrastructure` -> `application` -> `core` (Domain)。コアは他へ依存しない。
- **リポジトリ層:** `as unknown as DomainModel` 禁止。`infrastructure/repositories` にて明示的なマッパーを実装すること。
- **セキュリティ:** APIレスポンスは必ず Safe DTO を経由し、機密情報を除外する。
- **データベース:** 全テーブルUUID (v4)。中間テーブルは `media_{entity}` 命名。
- **API:** oRPCを使用。スキーマ駆動開発を徹底する。

## スキル一覧

| スキル名 | 説明 | ロード条件 |
|---|---|---|
| `solid-imager` | プロジェクト概要、セットアップ、コーディング規約 | 常時 |
| `orpc-api` | oRPC APIエンドポイント開発ワークフロー | API実装・変更時 |
| `solid-start-ssr` | SolidStart + TanStack Query SSR/CSRベストプラクティス | フロントエンド実装時 |
| `database-schema` | DBスキーマ変更・マイグレーション手順 | DBスキーマ変更時 |
| `ai-service` | Python AIサービス連携 | AI機能実装時 |
| `browser-extension` | xtracterブラウザ拡張機能開発 | 拡張機能変更時 |
| `api-docs` | OpenAPI仕様更新トリガー | API仕様更新時 |
| `safe-dto` | APIレスポンスのセキュリティ（Safe DTO） | APIレスポンス実装時 |
| `repository-rules` | リポジトリ層ルール（明示的マッピング） | リポジトリ実装時 |
| `schema-driven-dev` | ZodによるSchema-Driven Development | スキーマ定義時 |
| `ui-components` | solid-ui (shadcn/ui ポート) コンポーネント開発 | UIコンポーネント変更時 |
| `vite-plus` | Vite+ CLI操作（既存） | Vite+関連タスク時 |
| `cli` | imager-cli コマンド開発 | CLIコマンド追加・変更時 |
| `git-worktree` | git worktree を用いた並列開発ワークフロー | 複数PRの同時進行時 |
| `issue-driven` | GitHub Issue駆動開発ワークフロー（証跡・進捗管理） | issueをベースに開発作業を始めるとき |

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.

<!--VITE PLUS END-->
