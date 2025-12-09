# AGENTS.md - solid-imager

## プロジェクト概要

このプロジェクトは、AIによって生成された画像などのメディアを管理するために設計された、包括的なメディア管理システムです。ファイルの整理、検索、配信を行うためのバックエンドAPIとWebフロントエンドを提供します。

開発に着手する前に、以下の主要なドキュメントに目を通し、プロジェクトの全体像を理解してください。

-   **アーキテクチャ:** [./docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md)
-   **データベース設計:** [./docs/design/database-design.md](./docs/design/database-design.md)
-   **API設計:** [./docs/design/api-design.md](./docs/design/api-design.md) (詳細はSwagger UIを参照)
-   **技術スタック:** [./docs/design/technology-stack.md](./docs/design/technology-stack.md)

## 開発セットアップ

すべてのコマンドは `bun` を使用して実行します。

1.  **依存関係のインストール:**
    ```bash
    bun install
    ```

2.  **環境変数の設定:**
    `.env.example` をコピーして `.env` を作成し、データベース接続情報などを設定してください。
    ```bash
    cp .env.example .env
    ```

3.  **データベースのセットアップ:**
    使用するデータベースに応じて、マイグレーションを実行します。
    -   **PostgreSQL (Docker):**
        ```bash
        sudo -E docker compose --project-directory . up -d
        bun run db:migrate
        ```
    -   **PGlite:**
        ```bash
        # .env で DB_HOST=pglite を設定
        bun run db:migrate:pglite
        ```

## 開発フロー

### UIコンポーネント (solid-ui)

このプロジェクトでは、UIコンポーネントライブラリとして [solid-ui](https://www.solid-ui.com/) を使用しています。これは shadcn/ui の Solid.js へのポートです。

-   **初期化コマンド:**
    ```bash
    bunx solidui-cli@latest init
    ```
-   **コンポーネントの追加:**
    ```bash
    bunx solidui-cli@latest add [component]
    ```
    コンポーネント名は shadcn/ui と同じです。

### データベーススキーマの変更

1.  `src/infrastructure/db/schema.ts` を編集します。
2.  以下のコマンドで新しいマイグレーションファイルを生成します。
    ```bash
    bun run db:generate
    ```
3.  マイグレーションを適用します。
    ```bash
    bun run db:migrate
    # または
    bun run db:migrate:pglite
    ```
4.  データベースの内容を確認したい場合は、Drizzle Studio を使用します。
    ```bash
    bun run db:studio
    ```

### APIドキュメントの更新

APIエンドポイント（`src/routes/api/**/*.ts`）や共有スキーマ（`src/domain/**/*.ts`）にJSDocコメントを追加・修正した場合、以下のコマンドで `public/openapi.json` を再生成してください。

```bash
bun run gen:spec
```

### コード品質

コミットする前には、必ず **Biome** を使ってコードの品質をチェックしてください。

-   **チェックと修正の実行:**
    ```bash
    bun run check
    ```
-   **フォーマットのみの実行:**
    ```bash
    bun run format
    ```

### テスト

-   **ユニット/インテグレーションテストの実行:**
    ```bash
    bun run test
    ```
-   **E2Eテストの実行:**
    ```bash
    bun run test:e2e
    ```

## コーディング規約

-   **クリーンアーキテクチャ:** `ARCHITECTURE.md` に記載されているレイヤー間の依存関係ルールを厳守してください。ドメイン層は他のどのレイヤーにも依存してはいけません。
-   **型安全性:** `any` 型の使用は避け、TypeScriptの型システムを最大限に活用してください。型定義のインポートには `import type` を使用します。
-   **インポートエイリアス:** `src` ディレクトリへのエイリアスとして `~/*` を使用してください。(例: `import Nav from '~/components/Nav';`)
-   **Bun固有APIの回避:** ポータビリティを確保するため、`Bun.file()` のようなBun固有のAPIの使用は避け、可能な限りNode.js互換のAPIやWeb標準APIを使用してください。
-   **開発サーバーの不使用:** 開発サーバー (`bun run dev`) を起動しないでください。あなたの役割はコードの実装と修正であり、アプリケーションを直接実行することではありません。
-   **Schema-Driven Development (SDD) with Zod:**
    -   **Single Source of Truth:** データ構造（APIのRequest/Response、ドメインモデルなど）の定義は、関連する`schemas.ts`ファイルにZodスキーマとして記述することを唯一の正とします。
    -   **型の導出:** TypeScriptの型は、Zodスキーマから`z.infer`を用いて導出します。手書きで型を再定義することは禁止します。
    -   **実装例:**
        ```typescript
        import { z } from "zod";

        // Zodスキーマを定義
        export const userDataSchema = z.object({
          name: z.string(),
          email: z.string().email(),
        });

        // z.infer を使って型をエクスポート
        export type UserData = z.infer<typeof userDataSchema>;
        ```
