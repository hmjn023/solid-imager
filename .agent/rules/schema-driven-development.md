---
trigger: glob
description: Schema-Driven Development (SDD) における、Zodスキーマの定義と型導出のルール。ドメインモデルやAPIスキーマを定義する際に参照してください。
globs: apps/server/src/domain/**/schemas.ts
---

### Schema-Driven Development (SDD) with Zod

-   **Single Source of Truth:** データ構造（APIのRequest/Response、ドメインモデルなど）の定義は、関連する`schemas.ts`ファイルにZodスキーマとして記述することを唯一の正とします。
-   **型の導出:** TypeScriptの型は、Zodスキーマから`z.infer`を用いて導出します。手書きで型を再定義することは禁止します。
-   **実装例:**
    ```typescript
    import { z } from "zod";

    // Zodスキーマを定義
    export const userDataSchema = z.object({
      name: z.string(),
      email: z.string().email(),
    });

    // z.infer を使って型をエクスポート
    export type UserData = z.infer<typeof userDataSchema>;
    ```
