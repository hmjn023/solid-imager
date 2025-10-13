# Quickstart: Effect-TSを使用したDB操作

このドキュメントでは、Effect-TSを適用したDB操作系関数の基本的な使用方法を説明します。

## 1. DB操作の実行

Effect-TSを使用したDB操作は、`Effect.runPromise`または`Effect.runSync`で実行します。
以下は、メディアソースをすべて取得する例です。

```typescript
import { Effect } from "@effect/io/Effect";
import { pipe } from "@effect/data/Function";
import { MediaSourceDBOperations } from "~/specs/008-db-docs-design/contracts/db-operations"; // 仮のパス

// MediaSourceDBOperationsを実装したサービスを想定
const mediaSourceService: MediaSourceDBOperations = {
  // ... 実装
};

pipe(
  mediaSourceService.selectMediaSources(),
  Effect.flatMap(sources => Effect.sync(() => console.log("Media Sources:", sources))),
  Effect.catchAll(error => Effect.sync(() => console.error("Error:", error))),
  Effect.runPromise
);
```

## 2. エラーハンドリング

Effect-TSでは、`Effect.catchAll`や`Effect.catchTag`などを使用して、型安全なエラーハンドリングが可能です。

```typescript
import { Effect } from "@effect/io/Effect";
import { pipe } from "@effect/data/Function";
import { MediaSourceDBOperations, DBError } from "~/specs/008-db-docs-design/contracts/db-operations"; // 仮のパス

// MediaSourceDBOperationsを実装したサービスを想定
const mediaSourceService: MediaSourceDBOperations = {
  // ... 実装
};

pipe(
  mediaSourceService.selectMediaSourceById("invalid-uuid"),
  Effect.flatMap(source => {
    if (source) {
      return Effect.sync(() => console.log("Found Media Source:", source));
    } else {
      return Effect.fail({ _tag: "NotFoundError", message: "Media source not found" } as DBError);
    }
  }),
  Effect.catchTag("NotFoundError", error => Effect.sync(() => console.error("Not Found Error:", error.message))),
  Effect.catchAll(error => Effect.sync(() => console.error("Other Error:", error))),
  Effect.runPromise
);
```

## 3. 依存性注入 (DI)

Effect-TSの`Effect.provideService`や`Effect.service`を使用して、DB操作サービスを依存性注入できます。

```typescript
import { Effect, Layer } from "@effect/io/Effect";
import { pipe } from "@effect/data/Function";
import { MediaSourceDBOperations } from "~/specs/008-db-docs-design/contracts/db-operations"; // 仮のパス

// MediaSourceDBOperationsを実装したLayerを想定
const MediaSourceDBLive = Layer.succeed(MediaSourceDBOperations, {
  // ... MediaSourceDBOperationsの実装
});

pipe(
  Effect.serviceWithEffect(MediaSourceDBOperations, service => service.selectMediaSources()),
  Effect.flatMap(sources => Effect.sync(() => console.log("Media Sources:", sources))),
  Effect.catchAll(error => Effect.sync(() => console.error("Error:", error))),
  Effect.provideLayer(MediaSourceDBLive), // Layerを注入
  Effect.runPromise
);
```