---
name: database-schema
description: Drizzle ORMを用いたデータベーススキーマの定義とマイグレーションの生成・適用。テーブル定義の変更、インデックスの追加、'apps/server/src/infrastructure/db/schema.ts' の修正、または 'bun db:generate/migrate' コマンドを実行する際に使用してください。
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
