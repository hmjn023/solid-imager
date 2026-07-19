---
name: api-docs
description: APIエンドポイントやスキーマ変更に伴う OpenAPI 仕様書 ('apps/server/public/openapi.json') の更新。oRPC contract/router、JSDoc、'gen:spec' による仕様再生成を扱う時に使用する。
---

# API Documentation スキル

## Working Rules

APIエンドポイント（`apps/server/src/infrastructure/api/routers/**/*.ts`）、contract（`packages/core/src/domain/contract/**/*.ts`）、共有スキーマ（`packages/core/src/domain/**/*.ts`）を変更した場合は、公開仕様に影響するか確認します。仕様が変わる変更では `apps/server/public/openapi.json` を再生成します。

```bash
bun --filter @solid-imager/server run gen:spec
```

## Task Routing

| ユーザーの意図  | やること                                                 |
| --------------- | -------------------------------------------------------- |
| OpenAPI仕様更新 | `bun --filter @solid-imager/server run gen:spec`         |
| API仕様確認     | Swagger UI (`http://localhost:3000/docs/swagger`) を参照 |
