# Save Search Condition

現在、検索結果はリロードやページ遷移を行うと消えてしまう。
これを改善するために、検索条件をサーバーサイド（DB）に保存し、永続化する仕組みを導入する。

本機能は、[Implement Search Enhancement](./implement-search.md) で定義された新しい検索条件データ構造を利用する。

## 要件

*   **Current Stateの永続化**: ユーザーが現在操作している検索条件を "current" プリセットとして常に保存し、リロード後も復元できるようにする。
*   **プリセット保存**: よく使う検索条件に名前を付けて保存し、後から呼び出せるようにする。
*   **URL非依存**: 複雑な検索条件をURLパラメータに含めるのは困難であるため、URLにはプリセットの状態を含めず、内部状態として管理する。
*   **シングルユーザー前提**: 本アプリケーションはシングルユーザー利用を想定しており、プリセットは全てグローバルに共有される。

## 設計詳細

### 1. データベース設計 (Presets Table)

既存の `presets` テーブルを使用する。`value` カラムには `MediaSearchRequest` のJSONデータを格納する。

```typescript
/**
 * Schema for the presets table.
 */
export const presets = pgTable("presets", {
  id: serial("id").primaryKey(),
  /** プリセット名 (例: "current", "Favorites 2024") */
  // ユニーク制約により、同じ名前のプリセットは作成できない
  // "current" はシステム予約的な扱いとなる
  // 名前制約: 1〜100文字、空文字不可
  name: text("name").notNull().unique(),
  
  /** フィルター条件 (MediaSearchRequest) */
  value: jsonb("value").notNull(),
  
  /** 作成日時 */
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// システム予約プリセット名（削除不可）
export const RESERVED_PRESET_NAMES = ["current"] as const;
```

### 2. API設計 (oRPC - Presets Router)

`src/infrastructure/api/routers/presets-router.ts` を新規作成し、以下の操作を提供する。

#### 利用するスキーマ
*   `MediaSearchRequest`: [Implement Search Enhancement](./implement-search.md) で定義済み。

#### エンドポイント定義

```typescript
// プリセット名のバリデーションスキーマ
const presetNameSchema = z.string().min(1, "プリセット名は必須です").max(100, "プリセット名は100文字以内です");

export const presetsRouter = {
  // 全プリセット一覧取得（作成日時降順）
  list: os.handler(async () => {
    // return db.select().from(presets).orderBy(desc(presets.createdAt))
  }),
  
  // 名前による取得 ("current" の取得に使用)
  getByName: os.input(z.object({ name: presetNameSchema })).handler(async ({ input }) => {
     // 指定された名前のプリセットを返す
     // 存在しない場合は null を返す（フロントエンドで初期化処理を行う）
  }),
  
  // プリセット作成 ("名前を付けて保存")
  // "current" が存在しない場合の初期作成にも使用
  create: os.input(z.object({ 
    name: presetNameSchema, 
    value: mediaSearchRequestSchema 
  })).handler(async ({ input }) => {
    // 名前の重複チェックは DB のユニーク制約で行う
    // 重複時は適切なエラーメッセージを返す
    // insert into presets ...
  }),

  // プリセット更新（IDまたは名前のいずれか一方で指定）
  // "current" の状態同期や、既存プリセットの編集に使用
  update: os.input(z.union([
    z.object({ id: z.number(), value: mediaSearchRequestSchema }),
    z.object({ name: presetNameSchema, value: mediaSearchRequestSchema }),
  ])).handler(async ({ input }) => {
    // update presets set value = input.value where id = ... or name = ...
  }),
  
  // プリセット削除
  // 注意: "current" などの予約プリセットは削除不可
  delete: os.input(z.object({ id: z.number() })).handler(async ({ input }) => {
    // 削除対象が予約プリセットかチェック
    // if (RESERVED_PRESET_NAMES.includes(preset.name)) throw new Error("システムプリセットは削除できません")
    // delete from presets where id = ...
  })
};
```

### 3. フロントエンド実装フロー

#### A. アプリケーション初期化 / 検索画面ロード時
1.  **"current" プリセットの取得**:
    *   API: `presets.getByName({ name: "current" })` をコール。
    *   **存在する場合**: 返却された `value` (検索条件) をアプリケーションの状態 (Store) にセットし、検索を実行。
    *   **存在しない場合**: デフォルトの検索条件（空など）で `presets.create({ name: "current", value: defaultCondition })` をコールして作成し、Storeにセット。

#### B. 検索条件の変更時 (リアルタイム同期)
1.  ユーザーがUIで検索条件を変更（タグ追加、ソート変更など）。
2.  Storeの値を更新。
3.  **Debounce処理** (例: 500ms) を経て、API `presets.update({ name: "current", value: store.condition })` をコール。
    *   これにより、DB上の "current" が最新の状態になる。リロード時はAのフローによりここから復元される。

#### C. プリセットの保存 ("名前を付けて保存")
1.  ユーザーが「現在の条件を保存」ボタンをクリック。
2.  モーダル等でプリセット名を入力させる。
3.  API `presets.create({ name: userProvidedName, value: store.condition })` をコール。

#### D. プリセットの適用 (読み込み)
1.  プリセット一覧から任意のプリセットを選択。
2.  APIからそのプリセットの `value` を取得（または一覧取得時に持っているデータを使用）。
3.  Storeの値をその `value` で上書き。
4.  **重要**: 同時に `presets.update({ name: "current", value: newValue })` も行い、"current" も同期させる。

## エッジケース対応

### バリデーション失敗時のフォールバック

DB上の `value` が現在のスキーマ (`MediaSearchRequest`) と互換性がない場合の対応：

1.  `getByName` / `list` でプリセットを読み込む際、`value` を `mediaSearchRequestSchema.safeParse()` で検証する。
2.  検証失敗時は、該当プリセットの `value` を `null` として返し、フロントエンドでデフォルト条件にフォールバックさせる。
3.  ログに警告を出力し、管理者に通知する。

```typescript
const result = mediaSearchRequestSchema.safeParse(preset.value);
if (!result.success) {
  logger.warn(`プリセット "${preset.name}" のパースに失敗: ${result.error.message}`);
  return { ...preset, value: null };
}
return { ...preset, value: result.data };
```

### "current" プリセットの自動作成

アプリケーション起動時またはDB初期化時に "current" プリセットが存在しない場合、デフォルト値で自動作成する。

## タスク手順

1.  **Presets Router Implementation**: `src/infrastructure/api/routers/presets-router.ts` を実装し、`appRouter` に登録する。
2.  **Validation & Error Handling**: スキーマ検証失敗時のフォールバック処理を実装する。
3.  **Frontend State Management**: フロントエンド（SolidJS）で検索条件のStoreを実装し、上記のフロー（初期化、更新同期）を組み込む。
4.  **UI Implementation**: 検索条件保存モーダル、プリセット一覧表示、ロード機能のUIを実装する。
