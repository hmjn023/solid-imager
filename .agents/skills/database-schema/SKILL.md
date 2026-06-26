---
name: database-schema
description: Drizzle ORMを用いたデータベーススキーマの定義とマイグレーションの生成・適用。テーブル定義、インデックス、リレーション、'packages/db/src/schema.ts'、または db:generate/db:migrate 系コマンドを扱う際に使用する。
---

# Database Schema 変更スキル

## Working Rules

### スキーマ変更手順

1. `packages/db/src/schema.ts` を編集します。`apps/server/src/infrastructure/db/schema.ts` は再 export なので通常は直接編集しません。
2. 新しいマイグレーションファイルを生成:
   ```bash
   bun --filter @solid-imager/server run db:generate
   ```
3. マイグレーションを適用:
   ```bash
   bun --filter @solid-imager/server run db:migrate
   # または
   bun --filter @solid-imager/server run db:migrate:pglite
   ```
4. データベースの内容を確認:
   ```bash
   bun --filter @solid-imager/server run db:studio
   ```

### 注意事項
- スキーマ変更と生成されたマイグレーションは同じPRに含める。片方だけだと環境間でDB状態がずれるため。
- repository 実装は `packages/db/src/repositories/`、domain port は `packages/core/src/domain/repositories/` にある。

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| テーブル追加・変更 | `packages/db/src/schema.ts` 編集 → `db:generate` → `db:migrate` |
| DB内容の確認 | `db:studio` |
| マイグレーション適用 (PGlite) | `db:migrate:pglite` |
