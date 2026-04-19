---
name: repository-rules
description: リポジトリ層におけるデータアクセスとドメインモデルへの明示的なマッピングルール。データベースからの戻り値をドメインエンティティに変換する際や、'apps/server/src/infrastructure/repositories/' 配下での実装、および DBスキーマとドメイン層の型不整合を防ぐためのマッピング処理を行う際に使用してください。
---

# Repository Rules スキル

## Working Rules

- **明示的なマッピング:** データベースからの戻り値を `as unknown as Type` でキャストすることを禁止します。必ず `mapToDomain` などのヘルパー関数を作成し、明示的にマッピングしてください。これにより、DBスキーマの変更による型不整合を防ぎます。

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

| ユーザーの意図         | やること                                               |
| ---------------------- | ------------------------------------------------------ |
| リポジトリの新規実装   | `mapToDomain` ヘルパー関数を作成して明示的にマッピング |
| DBスキーマ変更後の対応 | `mapToDomain` を更新して型不整合を解消                 |
