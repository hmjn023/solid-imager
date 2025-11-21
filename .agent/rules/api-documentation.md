---
trigger: always_on
---
### APIドキュメントの更新

APIエンドポイント（`src/routes/api/**/*.ts`）や共有スキーマ（`src/domain/**/*.ts`）にJSDocコメントを追加・修正した場合、以下のコマンドで `public/openapi.json` を再生成してください。

```bash
bun run gen:spec
```
