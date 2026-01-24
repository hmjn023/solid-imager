---
trigger: glob
globs: src/infrastructure/db/schema.ts
description: データベースのスキーマ定義を変更する際の手順と、マイグレーションの生成・適用方法。DBスキーマを変更する作業時に参照してください。
---
### データベーススキーマの変更

1.  `src/infrastructure/db/schema.ts` を編集します。
2.  以下のコマンドで新しいマイグレーションファイルを生成します。
    ```bash
    bun run db:generate
    ```
3.  マイグレーションを適用します。
    ```bash
    bun run db:migrate
    # または
    bun run db:migrate:pglite
    ```
4.  データベースの内容を確認したい場合は、Drizzle Studio を使用します。
    ```bash
    bun run db:studio
    ```
