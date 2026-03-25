---
name: api-docs
description: APIエンドポイントやスキーマの変更に伴う OpenAPI 仕様書（'apps/server/public/openapi.json'）の更新。JSDoc コメントの記述ルールや 'bun gen:spec' コマンドによるドキュメントの再生成を行う際に使用してください。
---

# API Documentation スキル

## Working Rules

APIエンドポイント（`apps/server/src/infrastructure/api/routers/**/*.ts`）や共有スキーマ（`packages/core/src/domain/**/*.ts`）にJSDocコメントを追加・修正した場合、以下のコマンドで `apps/server/public/openapi.json` を再生成してください。

```bash
bun --filter @solid-imager/server gen:spec
```

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| OpenAPI仕様更新 | `bun --filter @solid-imager/server gen:spec` |
| API仕様確認 | Swagger UI (`http://localhost:3000/docs/swagger`) を参照 |
