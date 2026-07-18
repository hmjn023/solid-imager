# AGENTS.md - solid-imager

## プロジェクト概要

このプロジェクトは、AIによって生成された画像などのメディアを管理する包括的なメディア管理システムです。ファイルの整理、検索、配信を行うためのバックエンドAPIとWebフロントエンドを提供します。

## 主要ドキュメント

- **API設計:** [./docs/design/api-design.md](./docs/design/api-design.md) (詳細はSwagger UIを参照)
- **Tauri SPA設計:** [./docs/design/tauri-spa-architecture.md](./docs/design/tauri-spa-architecture.md)
- **DBスキーマ:** `packages/db/src/schema.ts` (`apps/server/src/infrastructure/db/schema.ts` は再 export)

## 開発ルール & 内部構成

### プロジェクト構成

- **`apps/server`**: `@solid-imager/server` (TanStack Start + oRPC)
- **`apps/tauri`**: `@solid-imager/tauri` (Tauri + 独立 SPA)
- **`apps/cli`**: `@solid-imager/cli` (Bun compileによるシングルバイナリ)
- **`apps/xtracter`**: ブラウザ拡張機能
- **`packages/core`**: `@solid-imager/core` (ドメインモデル、Zodスキーマ、contract、リポジトリIF)
- **`packages/application`**: `@solid-imager/application` (ユースケース・アプリケーションサービス)
- **`packages/db`**: `@solid-imager/db` (Drizzleスキーマ、DBリポジトリ実装)
- **`packages/ui`**: `@solid-imager/ui` (Shared UI Components)
- **`packages/client`**: `@solid-imager/client` (oRPC client factory)

### サーバー内部構成 (`apps/server/src/`)

- `application/`: アプリケーションサービス、ユースケース、レジストリ。
- `infrastructure/`: API実装, File System, AI連携, Job Queue, server固有のDB wiring。
- `presentation/`: ルート定義, グローバルストア。
- `components/`, `routes/`, `hooks/`: UIおよびルーティング関連。

### コア内部構成 (`packages/core/src/domain/`)

- ドメインごとにディレクトリを分離（`media`, `tags`, `characters`, `ips`, `authors` 等）。
- 各ドメイン配下に `schemas.ts` を配置し、Zodスキーマを定義する。

### アーキテクチャルール (Clean Architecture)

- **依存方向:** `infrastructure` -> `application` -> `core` (Domain)。コアは他へ依存しない。
- **リポジトリ層:** DB行を `as unknown as DomainModel` で飛ばさない。`packages/db/src/repositories/` の mapper に差分を集めると、DBスキーマ変更時の不整合を追いやすい。
- **セキュリティ:** APIレスポンスに機密情報が入り得る場合は Safe DTO へマッピングする。公開可能な型を明示すると、将来フィールドが増えた時の漏えいを防ぎやすい。
- **データベース:** 全テーブルUUID (v4)。中間テーブルは `media_{entity}` 命名。
- **API:** oRPCを使用。スキーマ駆動開発を徹底する。
- **型安全性:** アプリケーション本体コードで `any`、不要な `unknown`、`as unknown as ...`、`as any` による型のごまかしは禁止。外部ライブラリ境界では公開型、型ガード、Zod schema、明示的 mapper を優先し、やむを得ない場合は最小スコープに限定して理由をコメントする。テストコードの mock では例外的に許容する。

## スキル一覧

スキルは `.agents/skills/` 配下に配置する。

| スキル名 | 説明 | ロード条件 |
|---|---|---|
| `solid-imager` | プロジェクト概要、セットアップ、コーディング規約 | 全体設計や作業開始時 |
| `logging-rules` | ロギング方針、Pino loggerの利用、アプリケーション・コア層でのILogger依存注入ルール | ログ出力の実装・変更、デバッグコードの整理時 |
| `orpc-api` | oRPC APIエンドポイント開発ワークフロー | API実装・変更時 |
| `database-schema` | DBスキーマ変更・マイグレーション手順 | DBスキーマ変更時 |
| `ai-service` | Rust AIサービス連携 | AI機能実装時 |
| `browser-extension` | apps/xtracterブラウザ拡張機能開発 | 拡張機能変更時 |
| `api-docs` | OpenAPI仕様更新トリガー | API仕様更新時 |
| `safe-dto` | APIレスポンスのセキュリティ（Safe DTO） | APIレスポンス実装時 |
| `repository-rules` | リポジトリ層ルール（明示的マッピング） | リポジトリ実装時 |
| `schema-driven-dev` | ZodによるSchema-Driven Development | スキーマ定義時 |
| `ui-components` | solid-ui (shadcn/ui ポート) コンポーネント開発 | UIコンポーネント変更時 |
| `package-management` | Bun/Nodeパッケージ追加・更新・削除 | package.json・bun.lock変更時 |
| `vite-plus` | Vite+ CLI操作（既存） | Vite+関連タスク時 |
| `cli` | imager-cli コマンド開発 | CLIコマンド追加・変更時 |
| `git-worktree` | git worktree を用いた並列開発ワークフロー | 複数PRの同時進行時 |
| `git-pr` | ブランチ作成→コミット→push→PR作成の標準ワークフロー | 単一PRの作成時 |
| `issue-driven` | GitHub Issue駆動開発ワークフロー（証跡・進捗管理） | issueをベースに開発作業を始めるとき |
| `tanstack-ssr` | TanStack Start SSR、Selective SSR、hydration、loaderの診断と回帰防止 | F5・直接アクセス・Hydration Mismatch・SSR/CSR境界変更時 |
| `tanstack-db` | TanStack DBクライアントデータレイヤー（永続化、useLiveQuery、includes） | クライアント側データレイヤー変更時 |
| `realtime-events` | 型付きリアルタイムイベント、oRPC Event Iterator、pub/sub、再接続 | SSE・イベント配信・購読・イベントschema変更時 |
| `job-system` | background job、worker、dispatch、AI concurrency、batch親子進捗 | job type追加・非同期処理・batch操作変更時 |
| `media-search` | 検索schema、shared store、session persistence、preset、類似検索 | 検索条件・mode・検索画面変更時 |

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. In this checkout `vp` may not be installed globally, so run it through Bun as `bun x vp`. Vite+ invokes Vite through commands such as `bun x vp dev` and `bun x vp build`. Run `bun x vp help` to print a list of commands and `bun x vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `bun x vp install` after pulling remote changes and before getting started.
- [ ] Run `bun x vp check` and `bun x vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `bun x vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `bun x vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
