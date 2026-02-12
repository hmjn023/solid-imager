---
trigger: glob
globs: apps/server/src/infrastructure/repositories/**/*.ts
description: リポジトリ層の実装におけるデータマッピングのルール。データベースアクセスを行うコードを実装する際に参照してください。
---
### リポジトリのルール (Explicit Mapping)

-   **明示的なマッピング:** データベースからの戻り値を `as unknown as Type` でキャストすることを禁止します。必ず `mapToDomain` などのヘルパー関数を作成し、明示的にマッピングしてください。これにより、DBスキーマの変更による型不整合を防ぎます。
