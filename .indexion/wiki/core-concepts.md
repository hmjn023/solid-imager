# Core Concepts

`packages/core` はシステム全体の共有ドメインモデル層です。他パッケージへの依存は持ちません。

## ドメインモデル

### Media（メディア）

システムの中心となるエンティティ。画像・動画などのファイルを表します。

| フィールド | 説明 |
|---|---|
| `id` | UUID v4 |
| `mediaSourceId` | 所属するメディアソース |
| `path` | ストレージ内パス |
| `hash` | ファイルハッシュ（重複検出） |
| `metadata` | プロンプト、モデル名など |
| `tags` | 関連タグ一覧 |
| `characters` | 関連キャラクター一覧 |

### MediaSource（メディアソース）

ストレージバックエンドの抽象。1つのソースがローカル/SFTP/S3のいずれかに対応。

### Tag / Character / IP / Author

メディアに付与できるメタデータ分類：
- **Tag**: 汎用タグ（スタイル、シチュエーションなど）
- **Character**: キャラクター名
- **IP**: 知的財産（作品シリーズ）
- **Author**: 作者・モデル名

## Zodスキーマ

`packages/core/src/domain/` 配下、各ドメインディレクトリの `schemas.ts` に定義。

```
packages/core/src/domain/
├── media/
│   └── schemas.ts        # MediaSchema, MediaListSchema など
├── tags/
│   └── schemas.ts
├── characters/
│   └── schemas.ts
├── ips/
│   └── schemas.ts
└── authors/
    └── schemas.ts
```

## リポジトリインターフェース

`packages/core/src/interfaces/` にリポジトリのインターフェースを定義。  
実装は `apps/server/src/infrastructure/repositories/` に配置。

```typescript
// インターフェース（core）
interface IMediaRepository {
  findById(id: string): Promise<Media | null>;
  list(query: MediaListQuery): Promise<MediaList>;
  // ...
}

// 実装（server/infrastructure）
class DrizzleMediaRepository implements IMediaRepository {
  // Drizzle ORMを使った具体実装
  // ⚠️ `as unknown as DomainModel` 禁止 — 明示的マッパー必須
}
```

## Schema-Driven Development

oRPC APIは全てZodスキーマから型を生成：

1. `packages/core` でZodスキーマ定義
2. `z.infer<typeof Schema>` でTypeScript型を導出
3. oRPCルーターでスキーマをバリデーションとして使用
4. クライアント側は同じスキーマから型安全なAPIクライアントを生成

## Safe DTO パターン

APIレスポンスは機密情報を含まない安全なDTOを経由する：

```typescript
// ❌ DBエンティティを直接返さない
return dbUser;

// ✅ Safe DTOに変換
return toSafeUserDTO(dbUser);  // パスワードハッシュなどを除外
```

## イベント / リアルタイム更新

SSE（Server-Sent Events）を使ってクライアントへ変更を通知：
- メディア追加・更新・削除
- ジョブ状態変化
- `apps/server/src/routes/api/events.ts` に実装
