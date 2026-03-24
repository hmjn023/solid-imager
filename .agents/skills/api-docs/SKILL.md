---
name: api-docs
description: コードベースの変更に伴うAPI仕様書 (OpenAPI spec) の更新手順。APIのエンドポイントやスキーマを変更した後に参照してください。
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
