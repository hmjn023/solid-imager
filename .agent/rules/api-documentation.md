---
trigger: glob
globs: src/**/*.ts
description: コードベースの変更に伴うAPI仕様書 (OpenAPI spec) の更新手順。APIのエンドポイントやスキーマを変更した後に参照してください。
---

### APIドキュメントの更新

APIエンドポイント（`src/infrastructure/api/routers/**/*.ts`）や共有スキーマ（`src/domain/**/*.ts`）にJSDocコメントを追加・修正した場合、以下のコマンドで `public/openapi.json` を再生成してください。

```bash
bun run gen:spec
```
