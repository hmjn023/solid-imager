---
trigger: always_on
---
### APIドキュメントの更新

本プロジェクトでは、API仕様書（`public/openapi.json`）は **oRPCの定義とZodスキーマから自動生成** されます。

1.  **ルーター定義の変更時**:
    `src/infrastructure/api/routers/**/*.ts` でルーターやその入力/出力スキーマを変更した場合は、必ず仕様書を再生成してください。

2.  **説明文の更新**:
    APIの概要や説明文を変更したい場合は、JSDocではなく `scripts/generate-swagger-spec.ts` 内の `endpointDocs` オブジェクト、またはZodスキーマの `.describe()` メソッドを修正することを検討してください。

仕様書の再生成コマンド:

```bash
bun run gen:spec
```
