---
name: orpc-api
description: 共有Zod schema、oRPC contract/router、公開DTO、OpenAPI、APIクライアントを変更する時に使用する。
---

# oRPC API

## 変更手順

1. `packages/core/src/domain/{entity}/schemas.ts` のschemaと `z.infer` による共有型を更新する。
2. `packages/core/src/domain/contract/{entity}.contract.ts` で `openapi({ method, path })` と入出力を定義する。
3. `apps/server/src/infrastructure/api/routers/{entity}-router.ts` で `implement(contract)` により実装する。新規追加時はCoreの `contract/index.ts` とserverの `api/app-router.ts` に登録する。
4. `packages/client` と各appの `infrastructure/api-clients/` への影響を確認する。
5. 機密情報を含み得るエンティティは、既存のSafe schema・mapperを再利用し、公開フィールドを明示する。出力schemaと漏えいを検証するテストも合わせる。
6. 公開仕様が変わる場合はOpenAPIを生成し、`apps/server/public/openapi.json` の差分を同じ変更に含める。

```bash
bun run --cwd apps/server openapi:generate
```

HTTP API は `/api` の `OpenAPIHandler` が提供し、型付きクライアントは `OpenAPILink` を使う。公開仕様は契約の route metadata から生成し、`/docs/scalar` と `/openapi.json` で確認する。

## 実装・検証

- 入出力schemaはcontractを正本とし、routerで重複定義しない。router固有schemaはtransport専用の形状に限る。
- Routerは薄い入口に保ち、認可・DB・ファイル操作・job投入はapplication/serviceで扱う。
- バイナリ配信も契約に定義する。`ReadableStream<Uint8Array>` で配信し、ステータスやヘッダーが必要な場合は OpenAPI の詳細出力やレスポンスヘッダーを使う。原本は `HEAD` の本文なし応答と `Range` の `206`・`416` も検証する。
- エラーは `packages/core/src/domain/errors/` を使い、回復判断に必要なcode・messageを保持する。
- 型チェックと、`apps/server/src/tests/unit/infrastructure/{api,api-clients}/` または関連integration testで振る舞いを検証する。
