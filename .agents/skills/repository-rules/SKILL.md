---
name: repository-rules
description: リポジトリ層のデータアクセスとドメインモデルへの明示的マッピングを扱う。'packages/db/src/repositories/' の実装、DB行からドメイン型への変換、DBスキーマ変更後の mapper 調整時に使用する。
---

# Repository Rules スキル

## Working Rules

- **明示的なマッピング:** データベースからの戻り値を `as unknown as Type` でドメイン型へ飛ばさない。`mapToDomain` などの mapper を置くと、DB カラム名・nullable・JSON 型の差分が一箇所に集まり、スキーマ変更時の不整合をレビューしやすい。

```typescript
// ✅ Good
function mapToDomain(row: DbMediaRow): Media {
  return {
    id: row.id,
    fileName: row.file_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    createdAt: new Date(row.created_at),
  };
}

// ❌ Bad
const media = row as unknown as Media; // 型安全性が失われる
```

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| リポジトリの新規実装 | `mapToDomain` ヘルパー関数を作成して明示的にマッピング |
| DBスキーマ変更後の対応 | `mapToDomain` を更新して型不整合を解消 |
