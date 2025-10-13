# Tasks: DB操作系関数の実装

このドキュメントでは、DB操作系関数の実装に関する具体的なタスクを定義します。

## 1. DBエラーの定義

- [ ] `src/infrastructure/db/errors.ts`にEffect-TSのカスタムエラーを定義する。
  - `AppError`を基盤とし、`NotFoundError`, `DatabaseError`, `ConstraintError`など、DB操作で発生しうる具体的なエラーを定義する。
  - `Data.TaggedError`を使用して、型安全なエラー表現を行う。

## 2. DBサービスレイヤーの変更

- [ ] `src/infrastructure/db/layer.ts`をEffect-TSに対応させる。
  - `createDatabaseService`がEffectを返すように変更するか、`db`インスタンスをEffectのコンテキストとして提供するLayerを定義する。
  - 依存性注入の仕組みを検討し、`db`インスタンスをEffectの環境として提供できるようにする。

## 3. 既存DB操作関数のEffect化

- [ ] `src/infrastructure/db/index.ts`内の既存関数をEffectを返すように変更する。
  - `selectMediaSources`, `selectMediaSourceById`, `insertMediaSource`, `updateMediaSource`, `deleteMediaSource`など。
  - Drizzle ORMのPromiseベースの操作を`Effect.tryPromise`でラップする。
  - 適切なエラーハンドリング（`Effect.catchAll`や`Effect.catchTag`）を導入し、定義した`DBError`を返すようにする。
  - `pipe`関数を使用して、Effectの合成を行う。

## 4. 未実装DB操作関数の実装

- [ ] `docs/design/06-feature-details.md`で抽出した未実装のDB関数をEffect-TSを使用して実装する。
  - `research.md`の「1. `docs/design/06-feature-details.md`からのDB関数抽出」セクションを参照。
  - 各関数は`contracts/db-operations.md`で定義されたインターフェースに準拠するように実装する。
  - Effect-TSのパターン（`Effect.tryPromise`, `Effect.fail`, `Effect.succeed`, `pipe`など）を適用する。
  - 適切なエラーハンドリングと型安全性を確保する。

### 4.1. メディア配信・サムネイル作成機能
- [ ] `db.selectMediaBySourceId(sourceId)`

### 4.2. ワークフロー・自動化機能
- [ ] `db.insertMediaTags(...)`

### 4.3. フィルタ・プリセット機能
- [ ] `db.selectRecentMedia(sourceId)`

### 4.4. 外部連携機能
- [ ] `db.selectMediaById(mediaId)`

### 4.5. メディアメタデータ抽出機能
- [ ] `db.selectMediaGenerationInfoById(mediaId)`
- [ ] `db.updateMediaGenerationInfo(mediaId, ...)`

### 4.6. SSE機能
- [ ] `db.selectThumbnailJobStatus(sourceId)`

### 4.7. メディアアップロード機能
- [ ] `db.insertMedia(...)`

### 4.8. メディアソート・検索機能
- [ ] `db.searchMedia(sourceId, ...)`
- [ ] `db.searchMediaInDirectory(sourceId, directoriesPath, ...)`
- [ ] `db.globalSearchMedia(...)`

### 4.9. メディア情報編集機能
- [ ] `db.updateMedia(mediaId, ...)`

### 4.10. ディレクトリ管理機能
- [ ] `db.deleteMediaByPath(sourceId, directoryPath)`

### 4.11. カテゴリ管理機能
- [ ] `db.selectCategories()`
- [ ] `db.insertCategory(...)`
- [ ] `db.selectCategoryById(categoryId)`
- [ ] `db.updateCategory(categoryId, ...)`
- [ ] `db.deleteCategory(categoryId)`

### 4.12. キャラクター管理機能
- [ ] `db.selectCharacters()`
- [ ] `db.insertCharacter(...)`
- [ ] `db.selectCharacterById(characterId)`
- [ ] `db.updateCharacter(characterId, ...)`
- [ ] `db.deleteCharacter(characterId)`

### 4.13. IP (知的財産) 管理機能
- [ ] `db.selectIps()`
- [ ] `db.insertIp(...)`
- [ ] `db.selectIpById(ipId)`
- [ ] `db.updateIp(ipId, ...)`
- [ ] `db.deleteIp(ipId)`

### 4.14. ユーザー管理機能
- [ ] `db.selectUsers()`
- [ ] `db.insertUser(...)`
- [ ] `db.selectUserById(userId)`
- [ ] `db.updateUser(userId, ...)`
- [ ] `db.deleteUser(userId)`

### 4.15. コレクション管理機能
- [ ] `db.selectCollections()`
- [ ] `db.insertCollection(...)`
- [ ] `db.selectCollectionById(collectionId)`
- [ ] `db.updateCollection(collectionId, ...)`
- [ ] `db.deleteCollection(collectionId)`
- [ ] `db.insertCollectionMedia(...)`
- [ ] `db.deleteCollectionMedia(...)`

### 4.16. バルク操作機能
- [ ] `db.bulkUpdateMedia(sourceId, mediaIds, ...)`
- [ ] `db.bulkDeleteMedia(sourceId, mediaIds)`
- [ ] `db.bulkUpdateMediaPaths(sourceId, mediaIds, ...)`
- [ ] `db.bulkAddMediaTags(sourceId, mediaIds, tagsToAdd)`
- [ ] `db.bulkRemoveMediaTags(sourceId, mediaIds, tagsToRemove)`

### 4.17. データ移行・同期機能
- [ ] `db.selectMediaSourceData(sourceId)`
- [ ] `db.upsertMediaSourceData(sourceId, importData)`
- [ ] `db.reconcileMediaSource(sourceId, fileSystemChanges)`
- [ ] `db.cloneMediaData(sourceId, newSourceId)`

### 4.18. 統計・分析機能
- [ ] `db.selectSourceStats(sourceId)`
- [ ] `db.selectGlobalStats()`
- [ ] `db.findDuplicateMedia(sourceId)`
- [ ] `db.findSimilarMedia(sourceId, mediaPath)`
- [ ] `db.selectPopularMedia()`

### 4.19. ワークフロー・自動化機能
- [ ] `db.selectJobs()`
- [ ] `db.updateJobStatus(jobId, status)`
- [ ] `db.selectMediaForAutoTagging(sourceId)`
- [ ] `db.insertMediaTags(...)`

### 4.20. フィルタ・プリセット機能
- [ ] `db.selectPresets()`
- [ ] `db.insertPreset(...)`
- [ ] `db.selectRandomMedia(sourceId)`
- [ ] `db.selectRecentMedia(sourceId)`

## 5. テストの追加/更新

- [ ] 新しいDB操作関数とEffect-TSのエラーハンドリングを検証するテストを追加/更新する。
  - 既存のテストフレームワーク（Vitest）を使用する。
  - Effect-TSのテストユーティリティ（例: `Effect.runPromise`や`Effect.runSync`のテスト内での使用）を検討する。
  - モックやテスト用のLayerを使用して、DBへの実際のアクセスを分離する。

## 6. コードスタイルと品質の確認

- [ ] 実装後、`bun run check`を実行し、Biomeによるlintとformatのチェックをパスすることを確認する。
- [ ] 型エラーがないことを確認する。
