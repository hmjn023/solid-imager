# 検索機能の設計

メディア検索の実装構造。SimpleモードとProモードの2段階設計。

## 検索状態スキーマ（`packages/core/src/domain/search/schema.ts`）

全検索条件を1つのZodスキーマ `SearchState` で管理:

```typescript
{
  mode: "simple" | "pro",
  activePresetId: number | null,

  // Simple モードフィルター
  searchQuery: string,          // ファイル名・説明の部分一致
  selectedTags: string[],       // 含むタグ
  excludeTags: string[],        // 除外タグ
  tagMode: "and" | "or",       // タグ AND/OR
  selectedSource: string,       // メディアソースID
  selectedProjects: string[],
  selectedIps: string[],
  selectedCharacters: string[],
  selectedAuthors: string[],

  // Pro モードフィルター
  advancedCondition: SearchGroup | null,  // ネストした条件ツリー

  // ページネーション
  limit: number,
  offset: number,

  // ソート
  sortBy: "date" | "name" | "size" | "rating" | "viewCount",
  sortOrder: "asc" | "desc",

  scrollY: number,  // スクロール位置の復元用
}
```

## Proモードの条件ツリー（`SearchGroup`）

SimpleモードはAND固定だが、ProモードはOR/ANDをネストできる:

```typescript
type SearchGroup = {
  type: "group",
  operator: "and" | "or",
  negate?: boolean,
  children: (SearchGroup | SearchCriterion)[],
};

type SearchCriterion = {
  type: "criterion",
  field: "tag" | "project" | "ip" | "character" | "folder" | ...,
  operator: "includes" | "excludes" | "equals" | ...,
  value: string,
  negate?: boolean,
};
```

## モード切り替えロジック（`packages/core/src/domain/search/logic.ts`）

`calculateNextModeState()` がSimple ↔ Pro間の条件変換を担う:
- **Simple → Pro**: 現在のSimpleフィルターを `advancedCondition` に変換
- **Pro → Simple**: `advancedCondition` をSimpleフィルターに逆変換。変換不可能な複雑な条件の場合はSimpleをリセット

## 検索クエリの構築（`apps/server/src/infrastructure/repositories/media-repository-utils.ts`）

`buildWhereClause()` がDrizzle ORMのSQL条件を動的構築:

| フィルター | SQL |
|---|---|
| `searchQuery` | `LIKE '%query%'` on `fileName` or `description`（特殊文字エスケープ済み） |
| `tags` (AND mode) | `EXISTS(SELECT mediaId FROM media_tags ... GROUP BY mediaId HAVING COUNT DISTINCT = N)` |
| `tags` (OR mode) | `IN (SELECT mediaId FROM media_tags WHERE tagId IN (...))` |
| `excludeTags` | `NOT IN (SELECT mediaId FROM media_tags WHERE ...)` |
| `projects` | `EXISTS(SELECT mediaId FROM media_projects ...)` |
| `ips` | `EXISTS(SELECT mediaId FROM media_ips ...)` |
| `characters` | `EXISTS(SELECT mediaId FROM media_characters ...)` |

## ソート

| sortBy | 対応カラム |
|---|---|
| `date` | `media.createdAt` |
| `name` | `media.fileName` |
| `size` | `media.fileSize` |
| `rating` | `media_details.rating` (JOIN) |
| `viewCount` | `media_details.viewCount` (JOIN) |

## 検索の流れ

```
UI (SearchState)
    ↓ orpc.media.search({ sourceId, params })
MediaService.searchMedia()
    ↓
DrizzleMediaRepository.search()
    ↓
buildWhereClause() → Drizzle SQL
    ↓
PostgreSQL / PGlite
    ↓
mapToMedia() → Media[]
    ↓
{ items: Media[], total: number }
```

## プリセット保存

検索条件は `presets` テーブルに `name` + `value`（JSONB）として保存。`use-current-search-persistence.ts` フックが現在の検索状態を `"current"` プリセットとしてデバウンス付きで自動保存する（1000ms）。
