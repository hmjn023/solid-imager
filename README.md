# solid-imager

**solid-imager** は、[SolidStart](https://start.solidjs.com/) で構築された、クリーンアーキテクチャの原則に従うメディア管理アプリケーションです。ローカルやリモートにある大量のメディアファイル（特にAIによって生成された画像）を効率的に整理、検索、管理することを目的としています。

## 🌟 主な機能

- **複数メディアソース対応:** ローカルディレクトリ、SFTP、S3など、複数の場所にあるメディアを一元管理できます。
- **豊富なメタデータ管理:** AI生成情報（プロンプト、モデル、LoRAなど）、タグ、カテゴリ、キャラクター、IP（作品）など、多角的なメタデータをメディアに付与して管理できます。
- **柔軟な検索機能:** ファイル名、タグ、日付、その他のメタデータに基づいた強力な検索機能を提供します。
- **サムネイル生成:** メディアファイルのサムネイルを自動で生成し、高速なブラウジングを実現します。
- **リアルタイム更新:** ローカルのメディアソースに対して、ファイルの変更をリアルタイムで検知し、UIに反映します (SSEを利用)。
- **クリーンアーキテクチャ:** ドメイン、アプリケーション、インフラストラクチャ、プレゼンテーションの4層に分離された、メンテナンス性とテスト容易性の高い設計を採用しています。

## 🛠️ 技術スタック

- **フレームワーク:** [SolidStart](https://start.solidjs.com/)
- **言語:** [TypeScript](https://www.typescriptlang.org/)
- **ランタイム:** [Bun](https://bun.sh/)
- **データベース:** [PostgreSQL](https://www.postgresql.org/) または [PGlite](https://github.com/electric-sql/pglite) (SQLiteベース)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **UI:** [Kobalte](https://kobalte.dev/) (ヘッドレスUI) + [Tailwind CSS](https://tailwindcss.com/)
- **状態管理:** [TanStack Query](https://tanstack.com/query/latest)
- **フォーム管理:** [TanStack Form](https://tanstack.com/form/latest)
- **テスト:** [Vitest](https://vitest.dev/) (ユニット/インテグレーション), [Playwright](https://playwright.dev/) (E2E)
- **リンター/フォーマッター:** [Biome](https://biomejs.dev/)
- **APIドキュментация:** [Swagger / OpenAPI](https://swagger.io/)

📖 **詳細なアーキテクチャについては [こちら](./docs/architecture/ARCHITECTURE.md) を参照してください。**

## 📦 プロジェクト構成（モノレポ）

このプロジェクトは、複数のパッケージやアプリケーションから成るモノレポ構成を採用しています。

- **`apps/server`**: サーバーサイドの実装。SolidStartベースのメインアプリケーション。
- **`apps/cli`**: コマンドラインツール（CLI）および Model Context Protocol (MCP) サーバー実装。
- **`packages/core`**: 共通のビジネスロジック、ドメインモデル、および型定義。
- **`packages/ui`**: 共通のUIコンポーネントライブラリ。
- **`xtracter`**: ブラウザ拡張機能。

## 🚀 セットアップ手順

### 1. 依存関係のインストール

プロジェクトのルートディレクトリで実行します。

```bash
bun install
```

### 2. 環境変数の設定

`apps/server` ディレクトリ内の `.env.example` をコピーして `.env` を作成します。

```bash
cp apps/server/.env.example apps/server/.env
```

`apps/server/.env` ファイルを開き、ご自身の環境に合わせてデータベースの接続情報などを設定してください。

### 3. データベースの起動 (PostgreSQLの場合)

PostgreSQLを使用する場合は、Docker Composeでデータベースコンテナを起動します。

```bash
sudo -E docker compose --project-directory . up -d
```

### 4. データベースマイグレーション

`--filter` オプションを使用して、サーバーパッケージ内でコマンドを実行します。

**PostgreSQLの場合:**
```bash
bun --filter @solid-imager/server run db:migrate
```

**PGliteの場合:**
```bash
bun --filter @solid-imager/server run db:migrate:pglite
```

### 5. 開発サーバーの起動

ルートディレクトリから実行できます。

```bash
bun run dev
```

サーバーが起動したら、ブラウザで `http://localhost:3000` を開いてください。

## 📜 主要なスクリプト

- **`bun run dev`**: 開発サーバーを起動します。
- **`bun run test`**: Vitestによるユニットテストとインテグレーションテストを実行します。
- **`bun run test:e2e`**: PlaywrightによるE2Eテストを実行します。
- **`bun run lint`**: Biomeでリントチェックを実行します。
- **`bun run format`**: Biomeでコードのフォーマットを実行します。
- **`bun run gen:spec`**: ソースコード内のJSDocから `public/openapi.json` を生成します。
- **`bun run db:generate`**: Drizzle Kitで新しいマイグレーションファイルを生成します。
- **`bun run db:studio`**: Drizzle Studioを起動し、GUIでデータベースを操作します。
