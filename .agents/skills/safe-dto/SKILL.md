---
name: safe-dto
description: APIレスポンスにおける機密情報の取り扱いと、Safe DTOの使用に関するセキュリティルール。APIの戻り値を実装する際に参照してください。
---

# Safe DTO (APIレスポンスセキュリティ) スキル

## Working Rules

- **Safe DTO:** パスワードや秘密鍵などの機密情報を含むエンティティをそのままAPIレスポンスとして返さないでください。必ず `Safe` プレフィックスのついたスキーマ（例: `SafeMediaSource`）にマッピングし、機密情報を除外してから返却してください。

```typescript
// ✅ Good
export const sourcesRouter = {
  list: os.handler(async () => {
    const sources = await SourceService.getAllSources();
    return sources.map(toSafeMediaSource); // 機密情報を除外
  }),
};

// ❌ Bad
export const sourcesRouter = {
  list: os.handler(async () => {
    return await SourceService.getAllSources(); // パスワード等が含まれる可能性
  }),
};
```

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| 新しいエンティティのAPI公開 | `Safe` プレフィックスのスキーマとマッピング関数を作成 |
| APIレスポンスのセキュリティ確認 | 機密フィールドが含まれていないか検証 |
