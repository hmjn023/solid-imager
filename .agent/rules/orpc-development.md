---
trigger: glob
glob: "src/**/*.{ts,tsx}"
description: oRPCを用いたAPIエンドポイントの実装、ルーター定義、クライアント側からの呼び出し方法に関するルール。APIの実装や変更を行う際に参照してください。
---
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

#### oRPC ハンドラー実装ルール

-   すべてのAPIエンドポイントは `src/infrastructure/api/routers/` 配下に実装します。
-   入力スキーマは必ず `src/domain/{entity}/schemas.ts` で定義したZodスキーマを使用します。
-   ハンドラー内では直接データベースにアクセスせず、必ず `src/application/services/` のサービスクラスを経由します。
-   バイナリコンテンツ（画像、動画など）は oRPC では返さず、専用のRESTエンドポイントを使用します。
