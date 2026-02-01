# oRPC 実装ガイド

## 概要

**oRPC** は、TypeScript で完全な型安全性を提供する RPC (Remote Procedure Call) フレームワークです。このプロジェクトでは、従来の REST API に代わり、oRPC を使用してクライアントとサーバー間の通信を行っています。

### oRPC の利点

- ✅ **完全な型安全性**: クライアントとサーバーで型定義を共有
- ✅ **自動補完**: IDE で API の引数や戻り値が自動補完される
- ✅ **ランタイムバリデーション**: Zod スキーマによる入力検証
- ✅ **OpenAPI 自動生成**: ドキュメントが自動で生成される
- ✅ **コード量削減**: ボイラープレートが不要

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Component (Solid.js)                                │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  const client = createORPCClient()             │  │  │
│  │  │  await client.media.search({ ... })            │  │  │
│  │  │         ↓ (型安全な呼び出し)                    │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTP (JSON-RPC)
┌─────────────────────────────────────────────────────────────┐
│                         Backend                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Elysia Server                                       │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  /api/* → RPCHandler(appRouter)                │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Router (apps/server/src/infrastructure/api/routers/)           │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  mediaRouter.search                            │  │  │
│  │  │    .input(zodSchema)                           │  │  │
│  │  │    .handler(async ({ input }) => { ... })      │  │  │
│  │  │         ↓                                       │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Service (apps/server/src/application/services/)                │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  MediaService.searchMedia(...)                 │  │  │
│  │  │         ↓                                       │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Repository (apps/server/src/infrastructure/repositories/)      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  MediaRepository.findMany(...)                 │  │  │
│  │  │         ↓                                       │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Database (PostgreSQL / PGlite)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 実装手順

### 1. Zod スキーマの定義

まず、ドメイン層でデータ構造を Zod スキーマとして定義します。

**場所**: `packages/core/src/domain/{entity}/schemas.ts`

```typescript
// packages/core/src/domain/media/schemas.ts
import { z } from "zod";

/**
 * メディア検索リクエスト
 */
export const mediaSearchRequestSchema = z.object({
  q: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tagMode: z.enum(["and", "or"]).default("and"),
  excludeTags: z.array(z.string()).optional(),
  sort: z.enum(["date", "name", "size"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().default(0),
});

/**
 * メディア検索レスポンス
 */
export const mediaSearchResponseSchema = z.object({
  items: z.array(mediaSchema), // mediaSchema は同ファイル内で定義されたメディア単体のスキーマ
  total: z.number(),
  offset: z.number(),
  limit: z.number().nullable(),
});

// 型定義は z.infer で導出
export type MediaSearchRequest = z.infer<typeof mediaSearchRequestSchema>;
export type MediaSearchResponse = z.infer<typeof mediaSearchResponseSchema>;
```

### 2. ルーターの実装

次に、インフラストラクチャ層で oRPC ルーターを実装します。

**場所**: `apps/server/src/infrastructure/api/routers/{entity}-router.ts`

```typescript
// apps/server/src/infrastructure/api/routers/media-router.ts
import { os } from "@orpc/server";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";
import { ResourceNotFoundError } from "~/domain/errors";
import {
  mediaSearchRequestSchema,
  updateMediaRequestSchema,
} from "~/domain/media/schemas";

/**
 * Media Router Implementation
 */
export const mediaRouter = {
  /**
   * メディアを検索
   */
  search: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        params: mediaSearchRequestSchema,
      })
    )
    .handler(
      async ({ input }) =>
        await MediaService.searchMedia(input.sourceId, input.params)
    ),

  /**
   * 特定のメディアを取得
   */
  get: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      const media = await MediaService.getMedia(input.sourceId, input.mediaId);
      if (!media) {
        throw new ResourceNotFoundError("Media", input.mediaId);
      }
      return media;
    }),

  /**
   * メディア詳細を取得（タグ、カテゴリ等を含む）
   */
  getDetails: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
      })
    )
    .handler(
      async ({ input }) =>
        await MediaService.getMediaDetails(input.sourceId, input.mediaId)
    ),

  /**
   * メディア情報を更新
   */
  update: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
        data: updateMediaRequestSchema,
      })
    )
    .handler(
      async ({ input }) =>
        await MediaService.updateMedia(
          input.sourceId,
          input.mediaId,
          input.data
        )
    ),

  /**
   * メディアを削除
   */
  delete: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      await MediaService.deleteMedia(input.sourceId, input.mediaId);
      return { success: true };
    }),
};
```

### 3. ルーターの登録

実装したルーターをアプリケーションに登録します。

**場所**: `packages/core/src/domain/shared/api-contract.ts`

```typescript
// packages/core/src/domain/shared/api-contract.ts
import { mediaRouter } from "~/infrastructure/api/routers/media-router";
import { tagsRouter } from "~/infrastructure/api/routers/tags-router";
import { sourcesRouter } from "~/infrastructure/api/routers/sources-router";
// ... その他のルーター

/**
 * API Router Definition
 * フロントエンドとバックエンドで共有される型定義
 */
export const appRouter = {
  sources: sourcesRouter,
  media: mediaRouter,
  tags: tagsRouter,
  // ... その他のルーター
};

export type AppRouter = typeof appRouter;
```

### 4. クライアント側での使用

フロントエンドから型安全に API を呼び出します。

**場所**: `apps/server/src/routes/*.tsx` または `apps/server/src/components/*.tsx`

```typescript
// apps/server/src/routes/search.tsx
import { For } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { createORPCClient } from "~/infrastructure/api-clients/orpc-client";

export default function SearchPage() {
  const client = createORPCClient();

  // 型安全なクエリ
  const mediaQuery = createQuery(() => ({
    queryKey: ["media", "search"],
    queryFn: async () =>
      await client.media.search({
        sourceId: "some-uuid",
        params: {
          q: "example",
          tags: ["tag1", "tag2"],
          tagMode: "and",
          sort: "date",
          order: "desc",
          limit: 50,
          offset: 0,
        },
      }),
  }));

  return (
    <div>
      <h1>Search Results</h1>
      {mediaQuery.isLoading && <p>Loading...</p>}
      {mediaQuery.isError && <p>Error: {mediaQuery.error.message}</p>}
      {mediaQuery.data && (
        <ul>
          <For each={mediaQuery.data.items}>
            {(media) => (
              <li>
                {media.fileName}
                {/* ↑ 型が自動推論される！ */}
              </li>
            )}
          </For>
        </ul>
      )}
    </div>
  );
}
```

---

## エラーハンドリング

### カスタムエラーの定義

**場所**: `packages/core/src/domain/errors.ts`

```typescript
// packages/core/src/domain/errors.ts
export class ResourceNotFoundError extends Error {
  constructor(
    public resourceType: string,
    public resourceId: string
  ) {
    super(`${resourceType} with ID ${resourceId} not found`);
    this.name = "ResourceNotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(public errors: Record<string, string[]>) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}
```

### ルーター内でのエラー処理

```typescript
export const mediaRouter = {
  get: os
    .input(
      z.object({
        sourceId: z.string().uuid(),
        mediaId: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      const media = await MediaService.getMedia(input.sourceId, input.mediaId);
      
      // エラーをスロー
      if (!media) {
        throw new ResourceNotFoundError("Media", input.mediaId);
      }
      
      return media;
    }),
};
```

### グローバルエラーハンドラー

**場所**: `apps/server/src/infrastructure/api/app.ts`

```typescript
export const app = new Elysia()
  .onError(({ code, error, request }) => {
    if (error instanceof ResourceNotFoundError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (error instanceof ValidationError) {
      return new Response(JSON.stringify({ errors: error.errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.error(
      { err: error, code, path: request.url },
      "Unhandled Elysia Error"
    );
    
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  });
```

---

## バイナリコンテンツの扱い

oRPC は JSON ベースのプロトコル（JSON-RPC に類似）であり、すべてのレスポンスデータは JSON としてシリアライズされます。
そのため、画像や動画などのバイナリデータをそのまま返そうとすると、Base64エンコードによるデータサイズの増大（約33%増）や、シリアライズ/デシリアライズのCPU負荷が発生し、パフォーマンスが著しく低下します。

したがって、バイナリコンテンツは oRPC では返さず、必ず専用の REST エンドポイントを使用してください。

### ❌ 間違った実装

```typescript
// これはダメ！バイナリデータをJSONシリアライズできない
export const mediaRouter = {
  getContent: os
    .input(z.object({ sourceId: z.string(), mediaId: z.string() }))
    .handler(async ({ input }) => {
      const buffer = await readFile(path);
      return buffer; // ❌ Buffer は JSON にならない
    }),
};
```

### ✅ 正しい実装

**oRPC ルーター**: エラーをスローするか、URL を返す

```typescript
export const mediaRouter = {
  getContent: os
    .input(z.object({ sourceId: z.string(), mediaId: z.string() }))
    .handler(({ input }) => {
      // バイナリコンテンツ用の REST エンドポイントを使用するよう指示
      throw new Error(
        `Use the REST endpoint /api/sources/${input.sourceId}/${input.mediaId} for binary content.`
      );
    }),
};
```

**REST エンドポイント**: Elysia で直接実装

```typescript
// apps/server/src/infrastructure/api/app.ts
export const app = new Elysia()
  // ... 他の設定
  .get("/api/sources/:sourceId/:mediaId", async ({ params }) => {
    const { sourceId, mediaId } = params;
    const media = await MediaService.getMedia(sourceId, mediaId);
    
    if (!media) {
      throw new ResourceNotFoundError("Media", mediaId);
    }
    
    const filePath = await MediaService.getMediaPath(sourceId, mediaId);
    const buffer = await fs.readFile(filePath);
    
    return new Response(buffer, {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(buffer.length),
      },
    });
  });
```

---

## OpenAPI 自動生成

oRPC は OpenAPI 仕様を自動生成できます。

### 設定

**場所**: `apps/server/src/infrastructure/api/app.ts`

```typescript
import { OpenAPIGenerator } from "@orpc/openapi";
import { appRouter } from "~/domain/shared/api-contract";

const openApiGenerator = new OpenAPIGenerator();

export const app = new Elysia()
  .get("/api/openapi.json", async () => {
    const spec = await openApiGenerator.generate(appRouter, {
      info: {
        title: "Solid Imager oRPC API",
        version: "1.0.0",
        description: "API for managing media sources, media files, tags, and AI-powered features",
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Development server",
        },
      ],
    });

    // タグを自動割り当て
    assignTags(spec);

    return spec;
  });
```

### Swagger UI

開発サーバー起動中に以下の URL でアクセスできます:

- **OpenAPI Spec**: `http://localhost:3000/api/openapi.json`
- **Swagger UI**: `http://localhost:3000/docs/swagger`

---

## テストの書き方

### ユニットテスト

**場所**: `apps/server/src/tests/unit/routers/media-router.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mediaRouter } from "~/infrastructure/api/routers/media-router";

describe("mediaRouter", () => {
  beforeEach(async () => {
    // テスト用データベースのセットアップ
  });

  it("should search media with valid params", async () => {
    const result = await mediaRouter.search.handler({
      input: {
        sourceId: "test-source-id",
        params: {
          q: "test",
          limit: 10,
          offset: 0,
        },
      },
    });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });

  it("should throw error when media not found", async () => {
    await expect(
      mediaRouter.get.handler({
        input: {
          sourceId: "test-source-id",
          mediaId: "non-existent-id",
        },
      })
    ).rejects.toThrow("Media with ID non-existent-id not found");
  });
});
```

### インテグレーションテスト

```typescript
import { describe, it, expect } from "vitest";
import { createORPCClient } from "~/infrastructure/api-clients/orpc-client";

describe("Media API Integration", () => {
  const client = createORPCClient();

  it("should search media via client", async () => {
    const result = await client.media.search({
      sourceId: "test-source-id",
      params: { q: "test" },
    });

    expect(result.items).toBeInstanceOf(Array);
  });
});
```

---

## ベストプラクティス

### 1. 入力スキーマは必ずドメイン層で定義

```typescript
// ✅ Good
export const mediaRouter = {
  search: os
    .input(z.object({ sourceId: z.string(), params: mediaSearchRequestSchema }))
    .handler(async ({ input }) => { ... }),
};

// ❌ Bad - ルーター内でスキーマを直接定義しない
export const mediaRouter = {
  search: os
    .input(z.object({ q: z.string(), limit: z.number() }))
    .handler(async ({ input }) => { ... }),
};
```

### 2. ビジネスロジックはサービス層に

```typescript
// ✅ Good
export const mediaRouter = {
  search: os
    .input(searchSchema)
    .handler(async ({ input }) => {
      return await MediaService.searchMedia(input.sourceId, input.params);
    }),
};

// ❌ Bad - ルーター内に複雑なロジックを書かない
export const mediaRouter = {
  search: os
    .input(searchSchema)
    .handler(async ({ input }) => {
      const db = getDatabase();
      const results = await db.query(...); // ❌
      const filtered = results.filter(...); // ❌
      return filtered;
    }),
};
```

### 3. エラーは明示的に

```typescript
// ✅ Good
if (!media) {
  throw new ResourceNotFoundError("Media", mediaId);
}

// ❌ Bad
if (!media) {
  throw new Error("Not found"); // 情報が少ない
}
```

### 4. レスポンスは Safe DTO を使用

```typescript
// ✅ Good
export const sourcesRouter = {
  list: os
    .handler(async () => {
      const sources = await SourceService.getAllSources();
      return sources.map(toSafeMediaSource); // 機密情報を除外
    }),
};

// ❌ Bad
export const sourcesRouter = {
  list: os
    .handler(async () => {
      return await SourceService.getAllSources(); // パスワード等が含まれる可能性
    }),
};
```

---

## トラブルシューティング

### 型が推論されない

**原因**: `api-contract.ts` でルーターをエクスポートしていない

**解決策**:
```typescript
// packages/core/src/domain/shared/api-contract.ts
export const appRouter = {
  media: mediaRouter, // ここに追加
};
```

### "handler is not a function" エラー

**原因**: `.handler()` の呼び出しを忘れている

**解決策**:
```typescript
// ❌ Bad
export const mediaRouter = {
  search: os.input(schema), // handler() がない
};

// ✅ Good
export const mediaRouter = {
  search: os.input(schema).handler(async ({ input }) => { ... }),
};
```

### OpenAPI 仕様が生成されない

**原因**: ルーターに JSDoc コメントがない

**解決策**:
```typescript
/**
 * メディアを検索
 * @param sourceId - メディアソースID
 * @param params - 検索パラメータ
 */
export const mediaRouter = {
  search: os.input(...).handler(...),
};
```

---

## まとめ

oRPC を使用することで、型安全で保守性の高い API を構築できます。

**重要なポイント**:
1. ✅ Zod スキーマはドメイン層で定義
2. ✅ ルーターはインフラストラクチャ層で実装
3. ✅ ビジネスロジックはサービス層に委譲
4. ✅ バイナリコンテンツは REST エンドポイント
5. ✅ エラーハンドリングは明示的に
6. ✅ Safe DTO で機密情報を保護

詳細な API 仕様は [Swagger UI](http://localhost:3000/docs/swagger) を参照してください。
