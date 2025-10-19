# Research: DB操作系関数の実装

## 1. `docs/design/06-feature-details.md`からのDB関数抽出

`docs/design/06-feature-details.md`に記載されているDB関数を以下に抽出します。

### 2. メディア配信・サムネイル作成機能
- `db.selectMediaBySourceId(sourceId)`
- `db.selectMediaById(mediaId)`

### 19. ワークフロー・自動化機能
- `db.insertMediaTags(...)`

### 20. フィルタ・プリセット機能
- `db.selectRecentMedia(sourceId)`

### 21. 外部連携機能
- `db.selectMediaById(mediaId)`

### 3. メディアメタデータ抽出機能
- `db.selectMediaGenerationInfoById(mediaId)`
- `db.updateMediaGenerationInfo(mediaId, ...)`

### 4. SSE機能
- `db.selectThumbnailJobStatus(sourceId)` (if such a table exists)

### 5. メディアアップロード機能
- `db.insertMedia(...)`

### 6. 設定管理機能
- *直接的なDB操作なし（ファイルI/O）*

### 7. メディアソート・検索機能
- `db.searchMedia(sourceId, ...)`
- `db.searchMediaInDirectory(sourceId, directoriesPath, ...)`
- `db.globalSearchMedia(...)`

### 8. メディア情報編集機能
- `db.updateMedia(mediaId, ...)`

### 9. ディレクトリ管理機能
- `db.selectMediaSourceById(sourceId)`
- `db.deleteMediaByPath(sourceId, directoryPath)`

### 10. カテゴリ管理機能
- `db.selectCategories()`
- `db.insertCategory(...)`
- `db.selectCategoryById(categoryId)`
- `db.updateCategory(categoryId, ...)`
- `db.deleteCategory(categoryId)`

### 11. キャラクター管理機能
- `db.selectCharacters()`
- `db.insertCharacter(...)`
- `db.selectCharacterById(characterId)`
- `db.updateCharacter(characterId, ...)`
- `db.deleteCharacter(characterId)`

### 12. IP (知的財産) 管理機能
- `db.selectIps()`
- `db.insertIp(...)`
- `db.selectIpById(ipId)`
- `db.updateIp(ipId, ...)`
- `db.deleteIp(ipId)`

### 13. ユーザー管理機能
- `db.selectUsers()`
- `db.insertUser(...)`
- `db.selectUserById(userId)`
- `db.updateUser(userId, ...)`
- `db.deleteUser(userId)`

### 14. コレクション管理機能
- `db.selectCollections()`
- `db.insertCollection(...)`
- `db.selectCollectionById(collectionId)`
- `db.updateCollection(collectionId, ...)`
- `db.deleteCollection(collectionId)`
- `db.insertCollectionMedia(...)`
- `db.deleteCollectionMedia(...)`

### 15. バルク操作機能
- `db.bulkUpdateMedia(sourceId, mediaIds, ...)`
- `db.bulkDeleteMedia(sourceId, mediaIds)`
- `db.bulkUpdateMediaPaths(sourceId, mediaIds, ...)`
- `db.bulkAddMediaTags(sourceId, mediaIds, tagsToAdd)`
- `db.bulkRemoveMediaTags(sourceId, mediaIds, tagsToRemove)`

### 16. データ移行・同期機能
- `db.selectMediaSourceData(sourceId)`
- `db.upsertMediaSourceData(sourceId, importData)`
- `db.selectMediaSourceById(sourceId)`
- `db.reconcileMediaSource(sourceId, fileSystemChanges)`
- `db.insertMediaSource(...)`
- `db.cloneMediaData(sourceId, newSourceId)`
- `db.selectMediaById(mediaId)`

### 18. 統計・分析機能
- `db.selectSourceStats(sourceId)`
- `db.selectGlobalStats()`
- `db.findDuplicateMedia(sourceId)`
- `db.findSimilarMedia(sourceId, mediaPath)`
- `db.selectPopularMedia()`

### 22. ワークフロー・自動化機能
- `db.selectJobs()`
- `db.updateJobStatus(jobId, status)`
- `db.selectMediaForAutoTagging(sourceId)`
- `db.insertMediaTags(...)`

### 23. フィルタ・プリセット機能
- `db.selectPresets()`
- `db.insertPreset(...)`
- `db.selectRandomMedia(sourceId)`
- `db.selectRecentMedia(sourceId)`

## 2. 既存のDB操作系関数の調査

### 2.1. `src/infrastructure/db/index.ts`の調査結果

`src/infrastructure/db/index.ts`には、Drizzle ORMを使用した基本的なCRUD操作の例がいくつか含まれています。

-   **既存の関数の書き方**:
    -   `db.select().from(...).where(...)` のようなDrizzle ORMのクエリビルダーを使用。
    -   `eq`, `like`, `and` などのDrizzle ORMのヘルパー関数を使用。
    -   `returning()` を使用して、操作後のデータを返している。
    -   環境変数からDB接続情報を取得し、`Pool`を作成している。
    -   `createDatabaseService`という関数から`db`オブジェクトを取得している。

-   **Effect-TSの適用可能性**:
    -   現在の`index.ts`にはEffect-TSは直接使用されていません。
    -   各DB操作関数（例: `selectMediaSources`）の内部でEffectを構築し、エラーハンドリングを行う形が考えられます。
    -   Drizzle ORMのクエリはPromiseを返すため、`Effect.tryPromise`を使用してEffectに変換できます。

### 2.2. `src/infrastructure/db/layer.ts`の調査結果

`src/infrastructure/db/layer.ts`では、Drizzle ORMの`drizzle`関数を使用してデータベースサービスを作成していますが、Effect-TSは直接使用されていません。`createDatabaseService`は単に`drizzle`のインスタンスを返すシンプルなファクトリ関数です。

### 2.3. `src/infrastructure/db/errors.ts`の調査結果

`src/infrastructure/db/errors.ts`は現在、`// Placeholder for database-related errors`とコメントされているだけで、実際のエラー定義は含まれていません。Effect-TSを導入する際に、このファイルにカスタムエラーを定義する良い機会です。`docs/design/07-type-definitions.md`で定義した`AppError`型を参考に、具体的なDB関連のエラーを定義します。

### 2.4. `src/infrastructure/db/schema.ts`の調査結果

`src/infrastructure/db/schema.ts`には、Drizzle ORMのスキーマ定義が詳細に記述されています。

-   各テーブル（`mediaSources`, `medias`, `tags`, `mediaTags`など）の定義。
-   各カラムの型、制約、デフォルト値。
-   外部キー制約、インデックス定義、リレーション定義。
-   `InferSelectModel`と`InferInsertModel`を使用した型定義。

これらのスキーマ定義は、DB操作系関数を実装する上で非常に重要であり、Effect-TSで型安全なDB操作を行う際に活用できます。

## 3. Effect-TSの適用方針

-   各DB操作関数はEffectを返すように変更します。
-   Drizzle ORMのPromiseベースの操作は`Effect.tryPromise`でラップします。
-   `src/infrastructure/db/errors.ts`にDB操作固有のカスタムエラーを定義し、`Effect.fail`でそれらのエラーを返します。
-   `docs/design/07-type-definitions.md`で定義した`AppError`型を基盤として、より具体的なエラー型を定義します。
-   依存性注入（DI）を活用し、`db`インスタンスをEffectのコンテキストとして提供することを検討します。これにより、テスト容易性が向上し、モック化が容易になります。

## 4. `serena`ツールの活用方針

-   既存のDB操作系関数のリファクタリングや、新しい関数の追加時に、`serena__find_symbol`や`serena__find_referencing_symbols`を使用して関連するコードを特定します。
-   `serena__read_file`を使用して、既存のコードのパターンやスタイルを詳細に分析します。
-   `serena__replace_regex`や`serena__replace_symbol_body`を使用して、コードの変更を安全かつ効率的に行います。