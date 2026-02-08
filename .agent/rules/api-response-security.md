---
trigger: glob
globs: apps/server/src/infrastructure/api/**/*.ts
description: APIレスポンスにおける機密情報の取り扱いと、Safe DTOの使用に関するセキュリティルール。APIの戻り値を実装する際に参照してください。
---
### APIレスポンスのセキュリティ

-   **Safe DTO:** パスワードや秘密鍵などの機密情報を含むエンティティをそのままAPIレスポンスとして返さないでください。必ず `Safe` プレフィックスのついたスキーマ（例: `SafeMediaSource`）にマッピングし、機密情報を除外してから返却してください。
