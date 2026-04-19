# solid-imager Overview

AI生成画像などのメディアを管理する包括的なメディア管理システム。

## 目的

solid-imagerは、ローカル・SFTP・S3など複数のストレージバックエンドに分散したメディア（主にAI生成画像）を一元管理するためのシステムです。メタデータの管理、AIによる自動タグ付け、全文検索、サムネイル生成などの機能を提供します。

## 主な機能

- **複数ストレージ対応**: ローカルファイルシステム / SFTP / Amazon S3
- **メタデータ管理**: プロンプト、タグ、キャラクター、IP（知的財産）、作者
- **AI自動タグ付け**: Python（dghs-imgutils / onnxruntime）による画像解析
- **検索・フィルタリング**: 全文検索、タグ検索、メタデータフィルタ
- **サムネイル生成**: オンデマンド・バックグラウンド処理
- **リアルタイム更新**: SSE（Server-Sent Events）による状態同期
- **ファイル監視**: ディレクトリの変更をリアルタイム検知

## アプリケーション一覧

| アプリ | パッケージ名 | 説明 |
|---|---|---|
| `apps/server` | `@solid-imager/server` | メインWebアプリ（TanStack Start + oRPC） |
| `apps/tauri` | `@solid-imager/tauri` | デスクトップアプリ（Tauri + SolidJS） |
| `apps/cli` | `@solid-imager/cli` | CLIツール（シングルバイナリ） |
| `apps/xtracter` | - | ブラウザ拡張機能（メディア収集） |
| `src-python` | - | AI解析サービス（FastAPI） |

## 共有パッケージ

| パッケージ | 説明 |
|---|---|
| `packages/core` | ドメインモデル、Zodスキーマ、リポジトリインターフェース |
| `packages/ui` | 共通UIコンポーネント（Kobalte + Tailwind CSS） |

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| ランタイム | Bun |
| フレームワーク | TanStack Start / SolidJS |
| API | oRPC |
| UI | Kobalte + Tailwind CSS + solid-ui |
| データベース | PostgreSQL（サーバー） / PGlite（Tauri） |
| ORM | Drizzle ORM |
| バリデーション | Zod |
| AI/ML | Python（FastAPI、dghs-imgutils、onnxruntime） |
| テスト | Vitest / Playwright |
| Lint | Biome |
| デスクトップ | Tauri v2 |
