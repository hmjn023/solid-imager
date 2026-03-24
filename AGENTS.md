# AGENTS.md - solid-imager

## プロジェクト概要

このプロジェクトは、AIによって生成された画像などのメディアを管理する包括的なメディア管理システムです。ファイルの整理、検索、配信を行うためのバックエンドAPIとWebフロントエンドを提供します。

モノレポ構成で、サーバー(`apps/server`)、コアパッケージ(`packages/core`)、ブラウザ拡張機能(`xtracter`)で構成されています。

## 主要ドキュメント

- **API設計:** [./docs/design/api-design.md](./docs/design/api-design.md) (詳細はSwagger UIを参照)
- **DBスキーマ:** `apps/server/src/infrastructure/db/schema.ts`

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
