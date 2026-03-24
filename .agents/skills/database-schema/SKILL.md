---
name: database-schema
description: データベースのスキーマ定義を変更する際の手順と、マイグレーションの生成・適用方法。DBスキーマを変更する作業時に参照してください。
---

# Database Schema 変更スキル

## Working Rules

### スキーマ変更手順

1. `apps/server/src/infrastructure/db/schema.ts` を編集します。
2. 新しいマイグレーションファイルを生成:
   ```bash
   bun --filter @solid-imager/server db:generate
   ```
3. マイグレーションを適用:
   ```bash
   bun --filter @solid-imager/server db:migrate
   # または
   bun --filter @solid-imager/server db:migrate:pglite
   ```
4. データベースの内容を確認:
   ```bash
   bun --filter @solid-imager/server db:studio
   ```

### 注意事項
- マイグレーションファイルは git にコミットしてください
- スキーマの詳細は `apps/server/src/infrastructure/db/schema.ts` を参照してください

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| テーブル追加・変更 | `schema.ts` 編集 → `db:generate` → `db:migrate` |
| DB内容の確認 | `db:studio` |
| マイグレーション適用 (PGlite) | `db:migrate:pglite` |
