---
name: orpc-api
description: oRPCを用いた型安全なAPIエンドポイントの実装、ルーター定義、Zodスキーマによるバリデーション、およびフロントエンド（apps/server/src/routes/）からのクライアント呼び出し。APIの新規追加、既存エンドポイントの修正、OpenAPI定義の更新、または 'apps/server/src/infrastructure/api/routers/' 配下のファイルを操作する際に使用してください。
---

# oRPC API Development Skill

このプロジェクトでは、**型安全なRPCフレームワーク oRPC** を使用してAPIを実装しています。

- ✅ **完全な型安全性**: クライアントとサーバーで型定義を共有
- ✅ **自動補完**: IDE で API の引数や戻り値が自動補完される
- ✅ **ランタイムバリデーション**: Zod スキーマによる入力検証
- ✅ **OpenAPI 自動生成**: ドキュメントが自動で生成される

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| 新しいAPIエンドポイント追加 | Zodスキーマ → ルーター実装 → 登録 → クライアント呼び出し |
| エラーハンドリング追加 | `packages/core/src/domain/errors.ts` にカスタムエラー定義 |
| OpenAPI仕様更新 | `bun --filter @solid-imager/server gen:spec` |
| テスト追加 | `apps/server/src/tests/unit/routers/` にユニットテスト作成 |

## エンドポイントの追加手順

### 1. Zodスキーマの定義 (`packages/core/src/domain/{entity}/schemas.ts`)

```typescript
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
  items: z.array(mediaSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number().nullable(),
});

// 型定義は z.infer で導出
export type MediaSearchRequest = z.infer<typeof mediaSearchRequestSchema>;
export type MediaSearchResponse = z.infer<typeof mediaSearchResponseSchema>;
```

### 2. ルーターの実装 (`apps/server/src/infrastructure/api/routers/{entity}-router.ts`)

```typescript
import { os } from "@orpc/server";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";
import { ResourceNotFoundError } from "~/domain/errors";
import {
  mediaSearchRequestSchema,
  updateMediaRequestSchema,
} from "~/domain/media/schemas";

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

### 3. ルーターの登録 (`packages/core/src/domain/shared/api-contract.ts`)

```typescript
import { mediaRouter } from "~/infrastructure/api/routers/media-router";
import { tagsRouter } from "~/infrastructure/api/routers/tags-router";
import { sourcesRouter } from "~/infrastructure/api/routers/sources-router";

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

### 4. クライアント側での呼び出し

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
      {mediaQuery.isLoading && <p>Loading...</p>}
      {mediaQuery.data && (
        <ul>
          <For each={mediaQuery.data.items}>
            {(media) => (
              <li>
                {media.fileName}
                {/* 型が自動推論される！ */}
              </li>
            )}
          </For>
        </ul>
      )}
    </div>
  );
}
```

## Working Rules

### ハンドラー実装ルール
- すべてのAPIエンドポイントは `apps/server/src/infrastructure/api/routers/` 配下に実装
- 入力スキーマは必ず `packages/core/src/domain/{entity}/schemas.ts` のZodスキーマを使用
- ハンドラー内では直接DBにアクセスせず、必ず `apps/server/src/application/services/` のサービスクラスを経由
- バイナリコンテンツ（画像、動画など）は oRPC では返さず、専用のRESTエンドポイントを使用

### ベストプラクティス

**入力スキーマは必ずドメイン層で定義:**
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

**ビジネスロジックはサービス層に:**
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
      return results;
    }),
};
```

**エラーは明示的に:**
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

**レスポンスは Safe DTO を使用:**
```typescript
// ✅ Good
export const sourcesRouter = {
  list: os.handler(async () => {
    const sources = await SourceService.getAllSources();
    return sources.map(toSafeMediaSource); // 機密情報を除外
  }),
};

// ❌ Bad
export const sourcesRouter = {
  list: os.handler(async () => {
    return await SourceService.getAllSources(); // パスワード等が含まれる可能性
  }),
};
```

### エラーハンドリング

カスタムエラーを `packages/core/src/domain/errors.ts` に定義:

```typescript
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

oRPC ハンドラー内でカスタムエラーをスローすると、oRPC が HTTP ステータスへマップします。TanStack Router の server handler でも `Response` を直接返すことでエラーレスポンスを制御できます:
```typescript
// apps/server/src/routes/api/example.ts
export const Route = createFileRoute("/api/example")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const result = await someService();
          return Response.json(result);
        } catch (e) {
          if (e instanceof ResourceNotFoundError) {
            return new Response(JSON.stringify({ error: e.message }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
```

### バイナリコンテンツの扱い

oRPC は JSON ベースのため、画像等のバイナリデータは Base64 エンコードで約33%サイズ増大しパフォーマンスが低下。専用の REST エンドポイントを使用してください。

```typescript
// ❌ 間違った実装
export const mediaRouter = {
  getContent: os
    .input(z.object({ sourceId: z.string(), mediaId: z.string() }))
    .handler(async ({ input }) => {
      const buffer = await readFile(path);
      return buffer; // ❌ Buffer は JSON にならない
    }),
};

// ✅ 正しい実装 - REST エンドポイント (TanStack Router server handler)
// apps/server/src/routes/api/sources.$mediaSourceId.$mediaId.ts
export const Route = createFileRoute("/api/sources/$mediaSourceId/$mediaId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const filePath = await MediaService.getMediaPath(params.mediaSourceId, params.mediaId);
        const buffer = await fs.readFile(filePath);
        return new Response(buffer, {
          headers: {
            "Content-Type": media.mimeType,
            "Content-Length": String(buffer.length),
          },
        });
      },
    },
  },
});
```

### OpenAPI 自動生成

oRPC は OpenAPI 仕様を自動生成できます。設定は `apps/server/src/infrastructure/api/app.ts` で行います。

ルーターに JSDoc コメントを追加すると、OpenAPI 仕様に反映されます:
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

### テストの書き方

**ユニットテスト:**
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mediaRouter } from "~/infrastructure/api/routers/media-router";

describe("mediaRouter", () => {
  it("should search media with valid params", async () => {
    const result = await mediaRouter.search.handler({
      input: {
        sourceId: "test-source-id",
        params: { q: "test", limit: 10, offset: 0 },
      },
    });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });

  it("should throw error when media not found", async () => {
    await expect(
      mediaRouter.get.handler({
        input: { sourceId: "test-source-id", mediaId: "non-existent-id" },
      })
    ).rejects.toThrow("Media with ID non-existent-id not found");
  });
});
```

### トラブルシューティング
- **型が推論されない:** `api-contract.ts` でルーターをエクスポートしているか確認
- **"handler is not a function" エラー:** `.handler()` の呼び出し忘れ
- **OpenAPI仕様が生成されない:** ルーターにJSDocコメントがない可能性
