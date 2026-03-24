---
name: schema-driven-dev
description: Schema-Driven Development (SDD) における、Zodスキーマの定義と型導出のルール。ドメインモデルやAPIスキーマを定義する際に参照してください。
---

# Schema-Driven Development (SDD) with Zod スキル

## Working Rules

- **Single Source of Truth:** データ構造（APIのRequest/Response、ドメインモデルなど）の定義は、関連する`schemas.ts`ファイルにZodスキーマとして記述することを唯一の正とします。
- **型の導出:** TypeScriptの型は、Zodスキーマから`z.infer`を用いて導出します。手書きで型を再定義することは禁止します。

```typescript
// ✅ Good: Zodスキーマを定義
export const userDataSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

// ✅ Good: z.infer を使って型をエクスポート
export type UserData = z.infer<typeof userDataSchema>;

// ❌ Bad: 手書きで型を再定義
export type UserData = {
  name: string;
  email: string;
};
```

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| 新しいドメインモデル定義 | `{entity}/schemas.ts` にZodスキーマを定義し、`z.infer` で型を導出 |
| APIスキーマ定義 | `packages/core/src/domain/{entity}/schemas.ts` にスキーマを定義 |
