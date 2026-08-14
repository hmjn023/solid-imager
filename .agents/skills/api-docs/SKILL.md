---
name: api-docs
description: APIエンドポイントやスキーマ変更に伴う OpenAPI 仕様書 ('apps/server/public/openapi.json') の確認・更新。oRPC contract/router、OpenAPI metadata、Swagger UI を扱う時に使用する。
---

# API Documentation スキル

## Working Rules

APIエンドポイント（`apps/server/src/infrastructure/api/routers/**/*.ts`）、contract（`packages/core/src/domain/contract/**/*.ts`）、共有スキーマ（`packages/core/src/domain/**/*.ts`）を変更した場合は、公開仕様に影響するか確認します。仕様が変わる変更では `apps/server/public/openapi.json` とソースの差分を同期します。

現行リポジトリには `gen:spec` script はありません。仕様変更時は `apps/server/public/openapi.json` と contract/router の差分を確認し、生成・同期手順が追加された場合のみその手順を使います。仕様確認は `/docs/swagger` の Swagger UI、または `/openapi.json` を使います。

## Task Routing

| ユーザーの意図  | やること                                                 |
| --------------- | -------------------------------------------------------- |
| OpenAPI仕様更新 | contract/router と `apps/server/public/openapi.json` の差分を確認・同期 |
| API仕様確認     | Swagger UI (`http://localhost:3000/docs/swagger`) または `/openapi.json` を参照 |
