---
name: database-schema
description: DB schema・migration・repository・domain mapperを変更する時に使用する。repository単独の修正も対象。
---

# Database Development

- schema: `packages/db/src/schema.ts`。server側のschemaファイルは再export。
- repository port: `packages/core/src/domain/repositories/`
- DB実装・mapper: `packages/db/src/repositories/`

## Schema変更

schemaを編集し、migrationを生成・適用する。schemaと生成migrationは同じPRに含める。

```bash
bun --filter @solid-imager/server run db:generate
bun --filter @solid-imager/server run db:migrate
# PGliteの場合
bun --filter @solid-imager/server run db:migrate:pglite
# DB内容の確認
bun --filter @solid-imager/server run db:studio
```

## Repository変更

- Core portに操作を定義し、DB実装からapplication/serverへ依存させない。
- DB行はmapperで明示的に変換する。カラム名・nullable・JSON型とdomain schemaの差分を確認し、二重キャストで隠さない。
- serverでの組み立ては `@solid-imager/db` の `createRepositories`、テーブル参照は `@solid-imager/db/schema` を使う。
- schema変更がなければmigrationは不要。関連repository testと型チェックを行う。
