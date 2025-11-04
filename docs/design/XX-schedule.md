# バックエンド実装スケジュール

このスケジュールは、APIエンドポイント、DB操作関数、および内部ヘルパー関数の定義に基づき、機能間の依存関係を考慮して作成されています。

## フェーズ1: MVP（最小実行可能製品）

### 1. 環境セットアップ
- [x] **説明:** PostgreSQL、Drizzle ORM、Bunのセットアップ。
- **依存関係:** なし
- **機能:**
    - [x] `drizzle.config.ts`
    - [x] `schema.ts`
    - [x] `bun install`

### 2. 設定管理
- [ ] **説明:** `config.json` の読み書き。
- **依存関係:** 環境セットアップ
- **API関数:**
    - [ ] `ConfigService.getAppConfig()`
    - [ ] `ConfigService.updateAppConfig(configData: AppConfig)`
    - [ ] `ConfigService.resetAppConfig()`
- **DB関数:**
    - [ ] *直接的なDB操作なし（ファイルI/O）*

### 3. メディアソース管理 - 基本CRUD
- [ ] **説明:** ローカルメディアソースの登録、更新、削除。
- **依存関係:** 環境セットアップ
- **API関数:**
    - [ ] `MediaSourceService.getAllSources()`
    - [ ] `MediaSourceService.createSource(...)`
    - [ ] `MediaSourceService.getSourceDetails(mediaSourceId: UUID)`
    - [ ] `MediaSourceService.updateSource(...)`
    - [ ] `MediaSourceService.deleteSource(mediaSourceId: UUID)`
- **DB関数:**
    - [ ] `db.selectMediaSources()`
    - [ ] `db.insertMediaSource(...)`
    - [ ] `db.selectMediaSourceById(mediaSourceId)`
    - [ ] `db.updateMediaSource(mediaSourceId, ...)`
    - [ ] `db.deleteMediaSource(mediaSourceId)`

### 4. メディア配信 & メディア一覧
- [ ] **説明:** ローカルメディアの表示とディレクトリ内メディアの取得・表示。
- **依存関係:** メディアソース管理
- **API関数:**
    - [ ] `MediaService.getMedia(mediaSourceId: UUID, mediaId: UUID)`
    - [ ] `MediaSourceService.listSourceDirectories(mediaSourceId: UUID, parentPath?: string)`
    - [ ] `MediaSourceService.listMediaAndSubdirectories(mediaSourceId: UUID, directoriesPath: string)`
- **DB関数:**
    - [ ] `db.selectMediaById(mediaId)`
    - [ ] `db.selectMediaSourceById(mediaSourceId)`
- **内部ヘルパー関数:**
    - [ ] `LocalDriver.listDirectory(path: string)`
    - [ ] `LocalDriver.readFile(path: string)`

### 5. メディアメタデータ抽出
- [ ] **説明:** PNG tEXt領域からprompt/workflowの取得。
- **依存関係:** メディア配信
- **API関数:**
    - [ ] `MediaService.getMediaMetadata(mediaSourceId: UUID, mediaId: UUID)`
- **DB関数:**
    - [ ] `db.selectMediaGenerationInfoById(mediaId)`
- **内部ヘルパー関数:**
    - [ ] `ImageProcessor.extractMetadata(mediaPath: string)`
- [ ] **タグ抽出**
    - **説明:** ワークフローデータからタグを抽出。
    - **依存関係:** メディアメタデータ抽出
    - **内部ヘルパー関数:**
        - [ ] `WorkflowTagExtractor.extractTags(workflowJson: object)`

## フェーズ2: 実用性向上

### 6. サムネイル生成
- [ ] **説明:** バックグラウンド生成と進捗通知。
- **依存関係:** メディア配信、メディアメタデータ抽出
- **API関数:**
    - [ ] `ThumbnailService.getAllThumbnailLinks(mediaSourceId: UUID)`
    - [ ] `ThumbnailService.getMediaThumbnail(mediaSourceId: UUID, mediaId: UUID)`
    - [ ] `ThumbnailService.startThumbnailGeneration(mediaSourceId: UUID)`
    - [ ] `ThumbnailService.clearThumbnailCache(mediaSourceId: UUID)`
- **DB関数:**
    - [ ] `db.selectMediaBySourceId(mediaSourceId)`
    - [ ] `db.selectMediaById(mediaId)`
- **内部ヘルパー関数:**
    - [ ] `ImageProcessor.generateThumbnail(mediaPath: string, outputPath: string, size: number)`
    - [ ] `JobQueue.addThumbnailJob(...)`
    - [ ] `JobQueue.processNextJob()`

### 7. SSE監視
- [ ] **説明:** ファイル追加/削除のリアルタイム更新。
- **依存関係:** メディアソース管理、サムネイル生成
- **API関数:**
    - [ ] `EventService.startSseMonitoring(mediaSourceId: UUID)`
    - [ ] `EventService.getThumbnailProgressEvents(mediaSourceId: UUID)`
- **DB関数:**
    - [ ] `db.selectThumbnailJobStatus(mediaSourceId)`
- **内部ヘルパー関数:**
    - [ ] `SseManager.sendEvent(...)`
    - [ ] `SseManager.monitorFileSystem(...)`

### 8. メディアアップロード
- [ ] **説明:** ファイル保存と重複チェック。
- **依存関係:** メディアソース管理、メディアメタデータ抽出
- **API関数:**
    - [ ] `MediaService.uploadNewMedia(...)`
- **DB関数:**
    - [ ] `db.insertMedia(...)`
- **内部ヘルパー関数:**
    - [ ] `LocalDriver.writeFile(...)`
    - [ ] `ImageProcessor.extractMetadata(...)`

### 9. メディア情報編集
- [ ] **説明:** 説明、タグ、ファイル名変更。
- **依存関係:** メディア管理
- **API関数:**
    - [ ] `MediaService.updateMedia(...)`
    - [ ] `MediaService.deleteMedia(...)`
    - [ ] `MediaService.updateMediaMetadata(...)`
    - [ ] `MediaService.addMediaTag(...)`
    - [ ] `MediaService.removeMediaTag(...)`
    - [ ] `MediaService.addMediaCharacter(...)`
    - [ ] `MediaService.removeMediaCharacter(...)`
    - [ ] `MediaService.addMediaIp(...)`
    - [ ] `MediaService.removeMediaIp(...)`
- **DB関数:**
    - [ ] `db.updateMedia(...)`
    - [ ] `db.deleteMedia(...)`
    - [ ] `db.updateMediaGenerationInfo(...)`
    - [ ] `db.insertMediaTag(...)`
    - [ ] `db.deleteMediaTag(...)`
    - [ ] `db.insertMediaCharacter(...)`
    - [ ] `db.deleteMediaCharacter(...)`
    - [ ] `db.insertMediaIp(...)`
    - [ ] `db.deleteMediaIp(...)`

### 10. ディレクトリ管理
- [ ] **説明:** フォルダ作成/削除。
- **依存関係:** メディアソース管理
- **API関数:**
    - [ ] `DirectoryService.getDirectoryTree(mediaSourceId: UUID)`
    - [ ] `DirectoryService.createDirectory(...)`
    - [ ] `DirectoryService.deleteDirectory(...)`
    - [ ] `DirectoryService.updateDirectory(...)`
    - [ ] `DirectoryService.listMediaInSubdirectory(...)`
- **DB関数:**
    - [ ] `db.selectMediaSourceById(mediaSourceId)`
    - [ ] `db.deleteMediaByPath(mediaSourceId, directoryPath)`
- **内部ヘルパー関数:**
    - [ ] `LocalDriver.createDirectory(...)`
    - [ ] `LocalDriver.deleteDirectory(...)`
    - [ ] `LocalDriver.renamePath(...)`

## フェーズ3: 高度機能

### 11. メディアソース管理 - 拡張
- [ ] **説明:** SFTP/S3対応、接続テスト。
- **依存関係:** メディアソース管理
- **API関数:**
    - [ ] `MediaSourceService.testSourceConnection(mediaSourceId: UUID)`
- **内部ヘルパー関数:**
    - [ ] `SftpDriver.*`
    - [ ] `S3Driver.*`

### 12. メディアソート・検索
- [ ] **説明:** ファイル名・日付ソート、タグ検索、グローバル検索。
- **依存関係:** メディア管理、タグ管理
- **API関数:**
    - [ ] `MediaService.searchMedia(...)`
    - [ ] `MediaService.searchMediaInDirectory(...)`
    - [ ] `SearchService.globalSearchMedia(...)`
- **DB関数:**
    - [ ] `db.searchMedia(...)`
    - [ ] `db.searchMediaInDirectory(...)`
    - [ ] `db.globalSearchMedia(...)`

### 13. タグ管理
- [ ] **説明:** タグのCRUD操作。
- **依存関係:** なし
- **API関数:**
    - [ ] `TagService.getAllTags()`
    - [ ] `TagService.createTag(...)`
    - [ ] `TagService.getTagDetails(tagId: number)`
    - [ ] `TagService.updateTag(...)`
    - [ ] `TagService.deleteTag(tagId: number)`
- **DB関数:**
    - [ ] `db.selectTags()`
    - [ ] `db.insertTag(...)`
    - [ ] `db.selectTagById(tagId)`
    - [ ] `db.updateTag(tagId, ...)`
    - [ ] `db.deleteTag(tagId)`

### 14. カテゴリ管理
- [ ] **説明:** カテゴリのCRUD操作。
- **依存関係:** なし
- **API関数:**
    - [ ] `CategoryService.getAllCategories()`
    - [ ] `CategoryService.createCategory(...)`
    - [ ] `CategoryService.getCategoryDetails(categoryId: number)`
    - [ ] `CategoryService.updateCategory(...)`
    - [ ] `CategoryService.deleteCategory(categoryId: number)`
- **DB関数:**
    - [ ] `db.selectCategories()`
    - [ ] `db.insertCategory(...)`
    - [ ] `db.selectCategoryById(categoryId)`
    - [ ] `db.updateCategory(categoryId, ...)`
    - [ ] `db.deleteCategory(categoryId)`

### 15. キャラクター管理
- [ ] **説明:** キャラクターのCRUD操作。
- **依存関係:** IP管理
- **API関数:**
    - [ ] `CharacterService.getAllCharacters()`
    - [ ] `CharacterService.createCharacter(...)`
    - [ ] `CharacterService.getCharacterDetails(characterId: number)`
    - [ ] `CharacterService.updateCharacter(...)`
    - [ ] `CharacterService.deleteCharacter(characterId: number)`
- **DB関数:**
    - [ ] `db.selectCharacters()`
    - [ ] `db.insertCharacter(...)`
    - [ ] `db.selectCharacterById(characterId)`
    - [ ] `db.updateCharacter(characterId, ...)`
    - [ ] `db.deleteCharacter(characterId)`

### 16. IP (知的財産) 管理
- [ ] **説明:** IPのCRUD操作。
- **依存関係:** なし
- **API関数:**
    - [ ] `IpService.getAllIps()`
    - [ ] `IpService.createIp(...)`
    - [ ] `IpService.getIpDetails(ipId: number)`
    - [ ] `IpService.updateIp(...)`
    - [ ] `IpService.deleteIp(ipId: number)`
- **DB関数:**
    - [ ] `db.selectIps()`
    - [ ] `db.insertIp(...)`
    - [ ] `db.selectIpById(ipId)`
    - [ ] `db.updateIp(ipId, ...)`
    - [ ] `db.deleteIp(ipId)`

<!-- ### 17. ユーザー管理
- [ ] **説明:** ユーザーのCRUD操作。
- **依存関係:** なし
- **API関数:**
    - [ ] `UserService.getAllUsers()`
    - [ ] `UserService.createUser(...)`
    - [ ] `UserService.getUserDetails(userId: UUID)`
    - [ ] `UserService.updateUser(...)`
    - [ ] `UserService.deleteUser(userId: UUID)`
- **DB関数:**
    - [ ] `db.selectUsers()`
    - [ ] `db.insertUser(...)`
    - [ ] `db.selectUserById(userId)`
    - [ ] `db.updateUser(userId, ...)`
    - [ ] `db.deleteUser(userId)` -->

<!-- ### 18. コレクション管理
- [ ] **説明:** コレクションのCRUD操作とメディア管理。
- **依存関係:** ユーザー管理、メディア管理
- **API関数:**
    - [ ] `CollectionService.getAllCollections()`
    - [ ] `CollectionService.createCollection(...)`
    - [ ] `CollectionService.getCollectionDetails(collectionId: UUID)`
    - [ ] `CollectionService.updateCollection(...)`
    - [ ] `CollectionService.deleteCollection(collectionId: UUID)`
    - [ ] `CollectionService.addMediaToCollection(...)`
    - [ ] `CollectionService.removeMediaFromCollection(...)`
- **DB関数:**
    - [ ] `db.selectCollections()`
    - [ ] `db.insertCollection(...)`
    - [ ] `db.selectCollectionById(collectionId)`
    - [ ] `db.updateCollection(collectionId, ...)`
    - [ ] `db.deleteCollection(collectionId)`
    - [ ] `db.insertCollectionMedia(...)`
    - [ ] `db.deleteCollectionMedia(...)` -->

### 19. バルク操作
- [ ] **説明:** 複数メディアの一括処理。
- **依存関係:** メディア管理
- **API関数:**
    - [ ] `BulkOperationService.bulkEditMedia(...)`
    - [ ] `BulkOperationService.bulkDeleteMedia(...)`
    - [ ] `BulkOperationService.bulkMoveMedia(...)`
    - [ ] `BulkOperationService.bulkTagMedia(...)`
- **DB関数:**
    - [ ] `db.bulkUpdateMedia(...)`
    - [ ] `db.bulkDeleteMedia(...)`
    - [ ] `db.bulkUpdateMediaPaths(...)`
    - [ ] `db.bulkAddMediaTags(...)`
    - [ ] `db.bulkRemoveMediaTags(...)`

### 20. データ移行・同期
- [ ] **説明:** メディアソースのエクスポート、インポート、スキャン、複製。
- **依存関係:** メディアソース管理、メディア管理
- **API関数:**
    - [ ] `DataMigrationService.exportSource(...)`
    - [ ] `DataMigrationService.importDataIntoSource(...)`
    - [ ] `DataMigrationService.scanSource(...)`
    - [ ] `DataMigrationService.cloneSource(...)`
    - [ ] `DataMigrationService.downloadMedia(...)`
- **DB関数:**
    - [ ] `db.selectMediaSourceData(mediaSourceId)`
    - [ ] `db.upsertMediaSourceData(mediaSourceId, importData)`
    - [ ] `db.selectMediaSourceById(mediaSourceId)`
    - [ ] `db.reconcileMediaSource(mediaSourceId, fileSystemChanges)`
    - [ ] `db.insertMediaSource(...)`
    - [ ] `db.cloneMediaData(mediaSourceId, newSourceId)`
    - [ ] `db.selectMediaById(mediaId)`

### 21. 統計・分析機能
- [ ] **説明:** メディアの利用状況やシステム全体のパフォーマンスに関するデータ分析と監視。
- **依存関係:** メディア管理、閲覧履歴（未定義だが想定）
- **API関数:**
    - [ ] `AnalyticsService.getSourceStats(mediaSourceId: UUID)`
    - [ ] `AnalyticsService.getGlobalStats()`
    - [ ] `AnalyticsService.getDuplicateMedia(mediaSourceId: UUID)`
    - [ ] `AnalyticsService.getSimilarMedia(mediaSourceId: UUID, mediaPath: string)`
    - [ ] `AnalyticsService.getPopularMedia()`
- **DB関数:**
    - [ ] `db.selectSourceStats(mediaSourceId)`
    - [ ] `db.selectGlobalStats()`
    - [ ] `db.findDuplicateMedia(mediaSourceId)`
    - [ ] `db.findSimilarMedia(mediaSourceId, mediaPath)`
    - [ ] `db.selectPopularMedia()`

### 22. ワークフロー・自動化機能
- [ ] **説明:** バックグラウンドタスクやジョブの管理、AIによる自動タグ付け。
- **依存関係:** メディア管理、タグ管理
- **API関数:**
    - [ ] `WorkflowService.getJobList()`
    - [ ] `WorkflowService.cancelJob(jobId: number)`
    - [ ] `WorkflowService.autoTagMedia(mediaSourceId: UUID)`
- **DB関数:**
    - [ ] `db.selectJobs()`
    - [ ] `db.updateJobStatus(jobId, status)`
    - [ ] `db.selectMediaForAutoTagging(mediaSourceId)`
    - [ ] `db.insertMediaTags(...)`

### 23. フィルタ・プリセット機能
- [ ] **説明:** 検索条件の保存と再利用、ランダムなメディアや最近のメディアの取得。
- **依存関係:** メディア管理
- **API関数:**
    - [ ] `FilterPresetService.getPresets()`
    - [ ] `FilterPresetService.savePreset(presetData: { name: string, conditions: any })`
    - [ ] `MediaService.getRandomMedia(mediaSourceId: UUID)`
    - [ ] `MediaService.getRecentMedia(mediaSourceId: UUID)`
- **DB関数:**
    - [ ] `db.selectPresets()`
    - [ ] `db.insertPreset(...)`
    - [ ] `db.selectRandomMedia(mediaSourceId)`
    - [ ] `db.selectRecentMedia(mediaSourceId)`

<!-- ### 24. 外部連携機能
- [ ] **説明:** ComfyUIやDiscordなどの外部サービスとの連携。
- **依存関係:** メディア管理
- **API関数:**
    - [ ] `IntegrationService.uploadToComfyUi(mediaId: UUID, comfyUiUrl: string)`
    - [ ] `IntegrationService.getComfyUiWorkflows()`
    - [ ] `IntegrationService.sendDiscordNotification(message: string, webhookUrl: string)`
- **DB関数:**
    - [ ] `db.selectMediaById(mediaId)` -->