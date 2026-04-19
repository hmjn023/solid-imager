# リポジトリ層ルール

`apps/server/src/infrastructure/repositories/` に実装するリポジトリの規則。

## 基本原則

リポジトリはDBレコード（Drizzle の `InferSelectModel`）をドメインモデル（`packages/core` の型）へ**明示的なマッパー関数**で変換する。型キャストで誤魔化してはいけない。

## ❌ 禁止: `as unknown as DomainModel`

```typescript
// ❌ 型アサーションによる誤魔化し
const dbRecord = await db.select().from(medias).where(...);
return dbRecord as unknown as Media; // フィールドのミスマッチを隠蔽する
```

## ✅ 必須: 明示的なマッパー関数

```typescript
// apps/server/src/infrastructure/repositories/media-repository.ts

type DbMedia = InferSelectModel<typeof medias>;

// DBレコード → ドメインモデルへの明示的変換
function mapToMedia(dbMedia: DbMedia): Media {
	return {
		id: dbMedia.id,
		mediaSourceId: dbMedia.mediaSourceId,
		filePath: dbMedia.filePath,
		fileName: dbMedia.fileName,
		mediaType: dbMedia.mediaType,
		width: dbMedia.width,
		height: dbMedia.height,
		fileSize: dbMedia.fileSize ?? undefined,
		description: dbMedia.description ?? undefined,
		createdAt: dbMedia.createdAt,
		modifiedAt: dbMedia.modifiedAt,
		indexedAt: dbMedia.indexedAt,
		status: dbMedia.status,
	};
}

// リポジトリでマッパーを使用
export class DrizzleMediaRepository implements IMediaRepository {
	async findById(id: string): Promise<Media | null> {
		const [record] = await db.select().from(medias).where(eq(medias.id, id));
		return record ? mapToMedia(record) : null;
	}
}
```

## マッパー関数の書き方

### フィールド名の変換

DBはsnake_case、ドメインモデルはcamelCase。Drizzleがcamelにしてくれるが、明示的に書く。

```typescript
function mapToTag(dbTag: DbTag): Tag {
	return {
		id: dbTag.id,
		name: dbTag.name,
		description: dbTag.description ?? undefined, // null → undefined
		attribute: dbTag.attribute ?? undefined,
		color: dbTag.color ?? undefined,
		source: dbTag.source,
		authorId: dbTag.authorId ?? undefined,
		createdAt: dbTag.createdAt,
		updatedAt: dbTag.updatedAt,
	};
}
```

### NULL → undefined の変換

DBはNULLを返すが、ドメインモデルは `undefined` を使うケースが多い。`?? undefined` で変換する。

```typescript
description: dbRecord.description ?? undefined,
```

### JOINを含む複合マッパー

```typescript
function mapToMediaWithDetails(
	dbMedia: DbMedia,
	dbDetails: DbMediaDetails | null,
	dbTags: DbMediaTag[],
): MediaWithDetails {
	return {
		...mapToMedia(dbMedia),
		details: dbDetails ? mapToDetails(dbDetails) : null,
		tags: dbTags.map(mapToMediaTag),
	};
}
```

## インターフェースの遵守

リポジトリは `packages/core/src/domain/repositories/` のインターフェースを実装する:

```typescript
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";

export class DrizzleMediaRepository implements IMediaRepository {
	// インターフェースに定義された全メソッドを実装
}
```

## Tauri版との違い

Tauriのリポジトリはオブジェクトリテラル形式で、DBクライアントをDIコンテナ（`getTauriAppServices().db`）から取得する。マッパーはトップレベルに定義される点が異なるが、**変換ロジック自体は同じであるべき**。

```typescript
// Tauri版（apps/tauri/src/infrastructure/local-api/repositories/media-repository.ts）
function mapToMedia(dbMedia: DbMedia): Media {
	// serverと同じロジック
}

export const TauriMediaRepository: IMediaRepository = {
	async findById(id: string): Promise<Media | null> {
		const db = getTauriAppServices().db;
		const [record] = await db.select().from(medias).where(eq(medias.id, id));
		return record ? mapToMedia(record) : null;
	},
};
```
