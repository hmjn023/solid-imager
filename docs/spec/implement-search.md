# Implement Search Enhancement

現在の検索機能はタグやキーワードなどの単純な組み合わせに限られており、複雑な論理演算（(A OR B) AND C など）が表現できない。
これを解決するために、再帰的なクエリ構造を導入し、検索条件の表現力を向上させる。

このドキュメントでは、検索条件のデータ構造の刷新と、それに対応するバックエンドロジックの実装について定義する。
検索条件の保存機能については [Save Search](./save-search.md) で定義する。

## 要件

*   **AND/OR の任意連結**: ユーザーが自由に条件をグループ化し、AND/OR で結合できるようにする。
*   **再帰的構造**: 条件の中に条件グループを含められるようにする。
*   **多様な演算子**: 単純な一致だけでなく、包含、除外、範囲指定などをサポートする。
*   **バックエンド対応**: 新しいクエリ構造を受け取り、効率的なSQLを生成する。

## 設計詳細

### 1. 検索クエリのデータ構造 (Zod Schema)

従来のフラットなフィルタパラメータ (`tags`, `ips`, `q` など) は廃止し、全てのフィルタ条件を `condition` フィールド内の再帰的構造で表現する形式に刷新する。（後方互換性は考慮しない）
ただし、ページネーションやソートに関するフィールドはトップレベルに残す。

`src/domain/media/schemas.ts` を更新する。

```typescript
import { z } from "zod";

// 基本的な比較演算子
export const filterOperatorSchema = z.enum([
  "equals",      // 完全一致
  "contains",    // 部分一致 (LIKE %val%)
  "startsWith",  // 前方一致 (LIKE val%)
  "endsWith",    // 後方一致 (LIKE %val)
  "gt",          // Greater than (>)
  "gte",         // Greater than or equal (>=)
  "lt",          // Less than (<)
  "lte",         // Less than or equal (<=)
  "in",          // 配列に含まれる (IN)
  "notIn",       // 配列に含まれない (NOT IN)
  "isEmpty",     // 空またはNULL
  "isNotEmpty",  // 空でない
]);

// 検索対象のフィールド
export const filterTargetSchema = z.enum([
  "keyword",         // 全文検索 (ファイル名, パス, 説明, プロンプト等)
  "fileName",
  "filePath",
  "description",
  "mediaType",
  "width",
  "height",
  "fileSize",
  "createdAt",
  "rating",
  "favorite",
  "viewCount",
  "aiGenerated",
  // 関連テーブル
  "tag",             // タグ名またはID
  "author",          // 作者名またはID
  "project",         // プロジェクト名またはID
  "ip",              // IP名またはID
  "character",       // キャラクター名またはID
  "folder",          // ディレクトリパス (前方一致など)
]);

// 単一の検索条件ノード
export const searchCriterionSchema = z.object({
  type: z.literal("criterion"),
  target: filterTargetSchema,
  operator: filterOperatorSchema.default("equals"),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]).nullable(),
  negate: z.boolean().default(false).optional(), // NOT条件
});

// 条件グループノード (AND/OR)
export type SearchGroup = {
  type: "group";
  operator: "and" | "or";
  children: (SearchGroup | z.infer<typeof searchCriterionSchema>)[];
  negate?: boolean;
};

export const searchGroupSchema: z.ZodType<SearchGroup> = z.lazy(() =>
  z.object({
    type: z.literal("group"),
    operator: z.enum(["and", "or"]),
    children: z.array(z.union([searchGroupSchema, searchCriterionSchema])),
    negate: z.boolean().default(false).optional(),
  })
);

// 新しい検索リクエストスキーマ
// フィルタ条件は全て `condition` に集約
export const mediaSearchRequestSchema = z.object({
  condition: searchGroupSchema.optional(),
  sort: z.enum(["date", "name", "size", "rating", "viewCount"]).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type MediaSearchRequest = z.infer<typeof mediaSearchRequestSchema>;
```

### 2. クエリ構築ロジック (Repository層)

`MediaRepository.search` メソッドを刷新し、再帰的にSQLを構築するロジックを実装する。
`src/infrastructure/db/repositories/media-repository.ts` を修正する。

**実装アプローチ:**

*   **Recursive Builder**: `SearchGroup` または `SearchCriterion` を受け取り、Drizzleの `SQL` オブジェクトを返す再帰関数を実装する。
*   **SQL Operators**: `drizzle-orm` の `and`, `or`, `eq`, `like`, `not`, `exists` などを駆使する。
*   **Subqueries**: 関連テーブル（Tag, Characterなど）への条件は、メインクエリの `WHERE` 句内で `EXISTS` サブクエリとして表現する。これにより、`JOIN` による行の増幅や重複除去のオーバーヘッドを回避し、かつ正確な AND/OR 論理を実現する。

**実装イメージ:**

```typescript
import { and, or, eq, like, gt, gte, lt, lte, inArray, not, isNull, isNotNull, sql } from "drizzle-orm";

function buildSearchQuery(node: SearchNode): SQL | undefined {
  if (node.type === "group") {
    const conditions = node.children
      .map(buildSearchQuery)
      .filter((c): c is SQL => c !== undefined);

    if (conditions.length === 0) return undefined;

    const combined = node.operator === "and" ? and(...conditions) : or(...conditions);
    return node.negate ? not(combined) : combined;
  } 
  
  else if (node.type === "criterion") {
    // ターゲットに応じたカラムと条件式の生成
    const column = getColumnForTarget(node.target);
    let condition: SQL | undefined;

    switch (node.operator) {
      case "equals": condition = eq(column, node.value); break;
      case "contains": condition = like(column, `%${node.value}%`); break;
      // ... 他の演算子
    }
    
    // 関連テーブル(Tagなど)の場合はExists句やSubqueryを使う
    // 例: 特定のタグを持つメディア
    if (node.target === "tag") {
       condition = sql`EXISTS (
         SELECT 1 FROM ${mediaTags} 
         JOIN ${tags} ON ${mediaTags.tagId} = ${tags.id}
         WHERE ${mediaTags.mediaId} = ${medias.id} 
           AND ${tags.name} = ${node.value} -- または LIKE 検索など
       )`;
    }

    return node.negate ? not(condition) : condition;
  }
}
```

### 3. API (Media Router)

既存の `media.search` エンドポイント (`src/infrastructure/api/routers/media-router.ts`) は、自動的に新しい `MediaSearchRequest` スキーマを受け入れるようになる（スキーマ定義を参照しているため）。
実装側はリポジトリの変更により自動的に新ロジックが適用される。

## タスク手順

1.  **Schema Update**: `src/domain/media/schemas.ts` を更新し、新しい検索スキーマを定義する。
2.  **Repository Update**: `src/infrastructure/db/repositories/media-repository.ts` にクエリビルダロジックを実装し、`search` メソッドを更新する。
3.  **Frontend Update**: フロントエンドからのAPI呼び出し部分を一時的に修正するか、動作確認用の簡易スクリプトでAPIの疎通を確認する。（本格的なUI対応は別途実施）