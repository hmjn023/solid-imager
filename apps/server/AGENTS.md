# AGENTS.md - solid-imager

## プロジェクト概要

このプロジェクトは、AIによって生成された画像などのメディアを管理するために設計された、包括的なメディア管理システムです。ファイルの整理、検索、配信を行うためのバックエンドAPIとWebフロントエンドを提供します。

開発に着手する前に、以下の主要なドキュメントに目を通し、プロジェクトの全体像を理解してください。

-   **アーキテクチャ:** [./docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md)
-   **データベース設計:** [./docs/design/database-design.md](./docs/design/database-design.md)
-   **API設計:** [./docs/design/api-design.md](./docs/design/api-design.md) (詳細はSwagger UIを参照)
-   **oRPC実装ガイド:** [./docs/design/orpc-guide.md](./docs/design/orpc-guide.md)
-   **Python AIサービス:** [./docs/design/python-ai-service.md](./docs/design/python-ai-service.md)
-   **ブラウザ拡張機能:** [./docs/design/browser-extension.md](./docs/design/browser-extension.md) (詳細は [./xtracter/README.md](./xtracter/README.md))
-   **技術スタック:** [./docs/design/technology-stack.md](./docs/design/technology-stack.md)

## 開発セットアップ

すべてのコマンドは `bun` を使用して実行します。このプロジェクトはモノレポ構成になっており、サーバー (`apps/server`) とコアパッケージ (`packages/core`)、ブラウザ拡張機能 (`xtracter`) で構成されています。

1.  **依存関係のインストール:**
    ```bash
    bun install
    ```

2.  **環境変数の設定:**
    `apps/server/.env.example` をコピーして `apps/server/.env` を作成し、データベース接続情報などを設定してください。
    ```bash
    cp apps/server/.env.example apps/server/.env
    ```

3.  **データベースのセットアップ:**
    `apps/server` ディレクトリでコマンドを実行するか、`--filter @solid-imager/server` オプションを使用します。
    -   **PostgreSQL (Docker):**
        ```bash
        sudo -E docker compose --project-directory . up -d
        bun --filter @solid-imager/server run db:migrate
        ```
    -   **PGlite:**
        ```bash
        # .env で DB_HOST=pglite を設定
        bun --filter @solid-imager/server run db:migrate:pglite
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

### API開発 (oRPC)

このプロジェクトでは、**型安全なRPCフレームワーク oRPC** を使用してAPIを実装しています。

#### エンドポイントの追加手順

1.  **Zodスキーマの定義** (`src/domain/{entity}/schemas.ts`)
    ```typescript
    import { z } from "zod";
    
    export const createMediaRequestSchema = z.object({
      fileName: z.string(),
      filePath: z.string(),
    });
    ```

2.  **ルーターの実装** (`src/infrastructure/api/routers/{entity}-router.ts`)
    ```typescript
    import { os } from "@orpc/server";
    import { z } from "zod";
    
    export const mediaRouter = {
      create: os
        .input(createMediaRequestSchema)
        .handler(async ({ input }) => {
          // ビジネスロジックの実行
          return await MediaService.createMedia(input);
        }),
    };
    ```

3.  **ルーターの登録** (`src/domain/shared/api-contract.ts`)
    ```typescript
    export const appRouter = {
      media: mediaRouter,
      // ... その他のルーター
    };
    ```

4.  **クライアント側での呼び出し** (型安全！)
    ```typescript
    import { createORPCClient } from "~/infrastructure/api-clients/orpc-client";
    
    const client = createORPCClient();
    const result = await client.media.create({
      fileName: "example.png",
      filePath: "/path/to/file.png",
    });
    // ↑ 型が自動推論される！
    ```

詳細は [oRPC実装ガイド](./docs/design/orpc-guide.md) を参照してください。

### Python AIサービスの起動

画像タグ付けや類似度計算などのAI機能を使用する場合は、Python AIサービスを起動してください。

```bash
bun run ai:start
```

サービスは `http://localhost:8000` で起動します。

**提供される機能:**
- 画像の自動タグ付け (キャラクター、IP、一般タグ)
- CCIP (Content-based Copy-detection via Image Perceptual hashing) 特徴量抽出
- 画像間の類似度計算

詳細は [Python AIサービスドキュメント](./docs/design/python-ai-service.md) を参照してください。

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

APIエンドポイント（`src/infrastructure/api/routers/**/*.ts`）や共有スキーマ（`src/domain/**/*.ts`）にJSDocコメントを追加・修正した場合、以下のコマンドで `public/openapi.json` を再生成してください。

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
-   **インポートエイリアス:**
    -   `~/*`: `apps/server/src` へのエイリアス (サーバーサイドコード内)
    -   `@/*` または `@solid-imager/core/*`: `packages/core/src` へのエイリアス (共有ドメインロジック)
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
-   **リポジトリのルール (Explicit Mapping):**
    -   **明示的なマッピング:** データベースからの戻り値を `as unknown as Type` でキャストすることを禁止します。必ず `mapToDomain` などのヘルパー関数を作成し、明示的にマッピングしてください。これにより、DBスキーマの変更による型不整合を防ぎます。
-   **APIレスポンスのセキュリティ:**
    -   **Safe DTO:** パスワードや秘密鍵などの機密情報を含むエンティティをそのままAPIレスポンスとして返さないでください。必ず `Safe` プレフィックスのついたスキーマ（例: `SafeMediaSource`）にマッピングし、機密情報を除外してから返却してください。
-   **oRPC ハンドラー実装:**
    -   すべてのAPIエンドポイントは `apps/server/src/infrastructure/api/routers/` 配下に実装します。
    -   入力スキーマは必ず `packages/core/src/domain/{entity}/schemas.ts` で定義したZodスキーマを使用します。
    -   ハンドラー内では直接データベースにアクセスせず、必ず `apps/server/src/application/services/` のサービスクラスを経由します。
    -   バイナリコンテンツ（画像、動画など）は oRPC では返さず、専用のRESTエンドポイントを使用します。
-   **Python AI サービス連携:**
    -   Python AIサービスへの呼び出しは `apps/server/src/application/services/tagging-service.ts` を経由します。
    -   直接 HTTP リクエストを送信せず、必ずサービス層を通してください。
-   **ブラウザ拡張機能 (xtracter):**
    -   xtracter は独立したワークスペースです。変更を加える場合は `xtracter/` ディレクトリ内で作業してください。
    -   メインプロジェクトの依存関係とは分離されています。

