---
name: safe-dto
description: APIレスポンスの機密情報保護と Safe DTO へのマッピングを扱う。パスワード、鍵、接続情報などを含み得るエンティティをクライアントへ返す時や 'Safe' プレフィックス付き schema を使う時に参照する。
---

# Safe DTO (APIレスポンスセキュリティ) スキル

## Working Rules

- **Safe DTO:** パスワードや秘密鍵などの機密情報を含むエンティティは、そのままAPIレスポンスに返さない。`Safe` プレフィックスのスキーマ（例: `SafeMediaSource`）へ明示的にマッピングすると、レスポンス型を見ただけで公開可能なデータか判断でき、将来フィールドが増えた時の漏えいも防ぎやすい。

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

| ユーザーの意図                  | やること                                              |
| ------------------------------- | ----------------------------------------------------- |
| 新しいエンティティのAPI公開     | `Safe` プレフィックスのスキーマとマッピング関数を作成 |
| APIレスポンスのセキュリティ確認 | 機密フィールドが含まれていないか検証                  |
