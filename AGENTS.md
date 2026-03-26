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
| `issue-driven` | GitHub Issue駆動開発ワークフロー（証跡・進捗管理） | issueをベースに開発作業を始めるとき |

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->
