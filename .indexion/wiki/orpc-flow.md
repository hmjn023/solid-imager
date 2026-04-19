# oRPC API 開発フロー

型安全なRPCフレームワーク oRPC を使ったAPIエンドポイント追加の全体フロー。

## 概要

```
packages/core/domain/{entity}/schemas.ts   ← Zodスキーマ定義
    ↓
apps/server/src/infrastructure/api/routers/{entity}-router.ts  ← ルーター実装
    ↓
apps/server/src/domain/shared/api-contract.ts  ← appRouterに登録
    ↓
apps/server/src/orpc/client.ts or
apps/tauri/src/infrastructure/api/...          ← クライアント呼び出し
```

## Step 1: Zodスキーマ定義（`packages/core`）

```typescript
// packages/core/src/domain/media/schemas.ts
import { z } from "zod";

export const mediaSearchRequestSchema = z.object({
	q: z.string().optional(),
	tags: z.array(z.string()).optional(),
	limit: z.number().int().positive().default(50),
	offset: z.number().int().nonneg().default(0),
	sort: z.enum(["date", "name", "size"]).default("date"),
	order: z.enum(["asc", "desc"]).default("desc"),
});

export const mediaSchema = z.object({
	id: z.string().uuid(),
	mediaSourceId: z.string().uuid(),
	filePath: z.string(),
	fileName: z.string(),
	mediaType: z.enum(["image", "video", "audio"]),
	width: z.number(),
	height: z.number(),
	// ...
});

export type MediaSearchRequest = z.infer<typeof mediaSearchRequestSchema>;
export type Media = z.infer<typeof mediaSchema>;
```

## Step 2: ルーター実装（`apps/server/src/infrastructure/api/routers/`）

```typescript
// apps/server/src/infrastructure/api/routers/media-router.ts
import { ORPCError, os } from "@orpc/server";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import { mediaSearchRequestSchema } from "@solid-imager/core/domain/media/schemas";
import { z } from "zod";
import { MediaService } from "~/application/services/media-service";

export const mediaRouter = {
	search: os
		.input(
			z.object({
				sourceId: z.string().uuid().nullish(),
				params: mediaSearchRequestSchema,
			}),
		)
		.handler(async ({ input }) => await MediaService.searchMedia(input.sourceId, input.params)),

	get: os
		.input(
			z.object({
				sourceId: z.string().uuid(),
				mediaId: z.string().uuid(),
			}),
		)
		.handler(async ({ input }) => {
			const media = await MediaService.getMedia(input.sourceId, input.mediaId);
			if (!media) throw new ResourceNotFoundError("Media", input.mediaId);
			return media;
		}),
};
```

## Step 3: appRouter に登録

```typescript
// apps/server/src/domain/shared/api-contract.ts
import { mediaRouter } from "~/infrastructure/api/routers/media-router";

export const appRouter = {
	media: mediaRouter,
	// 他のルーター...
};
```

## Step 4: クライアント呼び出し（フロントエンド）

```typescript
// apps/server/src/orpc/client.ts で生成されたクライアントを使う
import { orpc } from "~/orpc/client";
import { createQuery } from "@tanstack/solid-query";

const mediaQuery = createQuery(() => ({
	queryKey: ["media", sourceId, params],
	queryFn: () => orpc.media.search({ sourceId, params }),
}));
```

## バイナリコンテンツの扱い

oRPC はJSON基盤のため、画像・動画などのバイナリは REST エンドポイントで配信する。

```typescript
// apps/server/src/routes/api/sources.$mediaSourceId.$mediaId.thumbnail.ts
export const Route = createFileRoute("/api/sources/$mediaSourceId/$mediaId/thumbnail")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const buffer = await fs.readFile(thumbnailPath);
				return new Response(buffer, {
					headers: { "Content-Type": "image/webp" },
				});
			},
		},
	},
});
```

## エラーハンドリング

```typescript
import { ORPCError } from "@orpc/server";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";

// ドメインエラーはそのままthrowしてよい（oRPCがHTTPステータスにマップ）
throw new ResourceNotFoundError("Media", mediaId);

// oRPCのエラーを直接使う場合
throw new ORPCError("NOT_FOUND", { message: "Media not found" });
```

## OpenAPI 仕様の生成

```bash
bun --filter @solid-imager/server run gen:spec
```

ルーターにJSDocを書くとOpenAPI仕様に反映される:

```typescript
/**
 * メディアを検索する
 * @summary Search media
 */
search: os.input(...).handler(...),
```

## ファイル命名規則

- ルーター: `{entity}-router.ts`（例: `media-router.ts`, `tags-router.ts`）
- appRouter のキー: 複数形のエンティティ名（例: `media`, `tags`, `sources`）
