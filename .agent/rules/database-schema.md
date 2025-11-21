---
trigger: always_on
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
