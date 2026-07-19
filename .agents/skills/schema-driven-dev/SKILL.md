---
name: schema-driven-dev
description: Schema-Driven Development (SDD) に基づく Zod スキーマ定義と TypeScript 型導出（z.infer）を扱う。API入出力、ドメインモデル、'packages/core/src/domain/**/schemas.ts' の共通データ構造を変更する時に使用する。
---

# Schema-Driven Development (SDD) with Zod スキル

## Working Rules

- **Single Source of Truth:** データ構造（APIのRequest/Response、ドメインモデルなど）の定義は、関連する`schemas.ts`ファイルにZodスキーマとして記述することを唯一の正とします。
- **型の導出:** APIやドメイン境界で共有される TypeScript 型は、Zodスキーマから `z.infer` で導出する。型とランタイム検証を別々に手書きすると、片方だけ更新される drift が起きやすいため。

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

| ユーザーの意図           | やること                                                          |
| ------------------------ | ----------------------------------------------------------------- |
| 新しいドメインモデル定義 | `{entity}/schemas.ts` にZodスキーマを定義し、`z.infer` で型を導出 |
| APIスキーマ定義          | `packages/core/src/domain/{entity}/schemas.ts` にスキーマを定義   |
