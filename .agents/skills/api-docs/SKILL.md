---
name: api-docs
description: APIエンドポイントやスキーマ変更に伴う OpenAPI 仕様書 ('apps/server/public/openapi.json') の確認・更新。oRPC contract/router、OpenAPI metadata、Scalar API Reference を扱う時に使用する。
---

# API Documentation スキル

## Working Rules

APIエンドポイント（`apps/server/src/infrastructure/api/routers/**/*.ts`）、contract（`packages/core/src/domain/contract/**/*.ts`）、共有スキーマ（`packages/core/src/domain/**/*.ts`）を変更した場合は、公開仕様に影響するか確認します。仕様が変わる変更では `apps/server/public/openapi.json` とソースの差分を同期します。

仕様は `packages/core/src/domain/contract/` のoRPC route metadataから生成します。contract/routerの変更後は `bun run --cwd apps/server openapi:generate` を実行して `apps/server/public/openapi.json` を更新します。仕様確認は `/docs/scalar` のScalar API Reference、または `/openapi.json` を使います。

## Task Routing

| ユーザーの意図  | やること                                                 |
| --------------- | -------------------------------------------------------- |
| OpenAPI仕様更新 | contract/router と `apps/server/public/openapi.json` の差分を確認・同期 |
| API仕様確認     | Scalar API Reference (`http://localhost:3000/docs/scalar`) または `/openapi.json` を参照 |
