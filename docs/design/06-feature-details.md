
# 機能詳細仕様

### 2. メディア配信・サムネイル作成機能

#### サムネイル仕様
- サイズ: クエリパラメータで指定 (?size=200, ?size=400等)
- キャッシュ: ローカルディスクにキャッシュ保存
- 対応形式: PNG, JPEG, WebP
- 生成: バックグラウンド生成（ジョブキュー）

#### サムネイル生成タイミング
- メディアソース追加時: 既存メディアの一括生成開始
- SSEで新メディア検知時: 個別メディアの生成開始
- 手動トリガー: 再生成API提供

#### 進捗通知（SSE）

#### API関数
- `ThumbnailService.getAllThumbnailLinks(sourceId: UUID)`
- `ThumbnailService.getMediaThumbnail(sourceId: UUID, mediaId: UUID)`
- `ThumbnailService.startThumbnailGeneration(sourceId: UUID)`
- `ThumbnailService.clearThumbnailCache(sourceId: UUID)`

#### DB関数
- `db.selectMediaBySourceId(sourceId)`
- `db.selectMediaById(mediaId)`

### 19. ワークフロー・自動化機能

#### 概要
バックグラウンドタスクやジョブの管理、AIによる自動タグ付けなどの自動化機能を提供します。

#### API関数
- `WorkflowService.getJobList()`
- `WorkflowService.cancelJob(jobId: number)`
- `WorkflowService.autoTagMedia(sourceId: UUID)`

#### DB関数
- `db.insertMediaTags(...)`

### 20. フィルタ・プリセット機能

#### 概要
検索条件の保存と再利用、ランダムなメディアや最近のメディアの取得機能を提供します。

#### API関数
- `FilterPresetService.getPresets()`
- `FilterPresetService.savePreset(presetData: { name: string, conditions: any })`
- `MediaService.getRandomMedia(sourceId: UUID)`
- `MediaService.getRecentMedia(sourceId: UUID)`

#### DB関数
- `db.selectRecentMedia(sourceId)`

### 21. 外部連携機能

#### 概要
ComfyUIやDiscordなどの外部サービスとの連携機能を提供します。

#### API関数
- `IntegrationService.uploadToComfyUi(mediaId: UUID, comfyUiUrl: string)`
- `IntegrationService.getComfyUiWorkflows()`
- `IntegrationService.sendDiscordNotification(message: string, webhookUrl: string)`

#### DB関数
- `db.selectMediaById(mediaId)`

### 3. メディアメタデータ抽出機能

#### データ構造
```typescript
interface MediaMetadata {
  // ComfyUI標準フィールド（JSON解析）
  prompt?: object;     // JSON.parse(textChunk["prompt"])
  workflow?: object;   // JSON.parse(textChunk["workflow"])
  
  // その他のキー（テキストのまま）
  parameters?: string;
  [key: string]: any;  // 将来的な拡張用
}
```

#### 処理仕様
1. PNGメディアからtEXtチャンクを読み取り
2. `prompt`, `workflow`キーはJSON解析を試行
3. 解析失敗時はテキストとして保持
4. その他キーはテキストのまま
5. メタデータが存在しない場合は空オブジェクト返却

#### タグ抽出
ワークフローデータ（特にComfyUIのワークフローJSON）から、特定のノードや設定に基づいてタグを自動的に抽出します。抽出されたタグは `MediaMetadata.extractedTags` に保存されます。

#### API関数
- `MediaService.getMediaMetadata(sourceId: UUID, mediaId: UUID)`
- `MediaService.updateMediaMetadata(sourceId: UUID, mediaId: UUID, metadata: any)`

#### DB関数
- `db.selectMediaGenerationInfoById(mediaId)`
- `db.updateMediaGenerationInfo(mediaId, updates: { metadata?, prompt?, negativePrompt?, workflow?, loras?, vae?, hypernetworks?, embeddings?, aiGenerated?, modelName?, seed?, cfgScale?, steps? })`
- `db.insertMediaGenerationInfo(mediaId, generationInfo: { metadata?, prompt?, negativePrompt?, workflow?, loras?, vae?, hypernetworks?, embeddings?, aiGenerated?, modelName?, seed?, cfgScale?, steps? })`
- `db.selectMediaByWorkflow(workflowHash: string)` - ワークフローハッシュから類似メディアを検索
- `db.selectMediaByPrompt(promptText: string)` - プロンプトテキストから検索

#### 内部ヘルパー関数
- `ImageProcessor.extractMetadata(mediaPath: string)`
- `WorkflowTagExtractor.extractTags(workflowJson: object)`

### 4. SSE機能

#### 対象範囲
- `type: 'local'` のメディアソースのみ対応
- SFTP/S3は非対応

#### データ構造

#### 監視仕様
- ライブラリ: chokidar でファイルシステム監視
- 対象: メディアファイル（.png, .jpg, .jpeg, .webp等）
- 範囲: サブディレクトリも再帰的に監視
- エラー: 非localソースは "ローカルファイルソースのみ対応" エラー

#### API関数
- `EventService.startSseMonitoring(sourceId: UUID)`
- `EventService.getThumbnailProgressEvents(sourceId: UUID)`

#### DB関数
- `db.selectThumbnailJobStatus(sourceId)` (if such a table exists)

### 5. メディアアップロード機能

#### 対応状況
- **Phase 1**: `type: 'local'` のみ対応
- **Phase 2**: SFTP/S3 対応予定

#### ファイル名処理
- カスタム名優先、未指定時は元ファイル名使用
- `autoIncrement: true` 時は `media_001.png`, `media_002.png` 形式
- 重複時は `conflict` 情報を返してユーザー確認要求

#### API関数
- `MediaService.uploadNewMedia(sourceId: UUID, uploadData: { file: File, filename?: string, autoIncrement?: boolean, description?: string, sourceUrl?: string, overwrite?: boolean })`

#### DB関数
- `db.insertMedia(...)`

### 6. 設定管理機能

#### 設定構造

#### ファイル保存
- 保存場所: プロジェクトルート `config.json`
- フォーマット: JSON形式
- 自動バックアップ: 更新時に `config.json.backup` 作成

#### API関数
- `ConfigService.getAppConfig()`
- `ConfigService.updateAppConfig(configData: AppConfig)`
- `ConfigService.resetAppConfig()`

#### DB関数
- *直接的なDB操作なし（ファイルI/O）*

### 7. メディアソート・検索機能

#### ソート条件
- 作成日時（created_at）
- 更新日時（modified_at）
- ファイル名（file_name）
- 評価（rating）
- 閲覧回数（view_count）

#### 検索条件
- ファイル名（部分一致）
- 説明文（description）
- タグ（AND/OR条件）
- キャラクター（名前またはエイリアス）
- カテゴリ
- プロジェクト
- IP（作品）
- 評価範囲
- 日付範囲
- AI生成フラグ
- 使用モデル名
- プロンプト文字列（部分一致）
- LoRA名（JSONB検索）

#### 実装方針
- **Phase 1**: ファイルシステムベース（都度メタデータ読み取り）
- **Phase 2**: DB対応でパフォーマンス改善予定
- ページネーション対応（デフォルト50件）
- タグ検索は AND 条件で実装
- AI生成パラメータでの高度な検索対応

#### API関数
- `MediaService.searchMedia(sourceId: UUID, searchOptions: SearchOptions)`
- `MediaService.searchMediaInDirectory(sourceId: UUID, directoriesPath: string, searchOptions: SearchOptions)`
- `SearchService.globalSearchMedia(searchOptions: SearchOptions)`
- `SearchService.searchByGenerationParams(params: { modelName?, prompt?, loras?, minCfgScale?, maxCfgScale? })`
- `SearchService.searchByCharacter(characterNameOrAlias: string)` - キャラクター名またはエイリアスから検索

#### DB関数
- `db.searchMedia(sourceId, filters: { fileName?, description?, tags?, characters?, categories?, projects?, ips?, ratingMin?, ratingMax?, dateFrom?, dateTo?, aiGenerated?, modelName?, prompt? })`
- `db.searchMediaInDirectory(sourceId, directoriesPath, filters)`
- `db.globalSearchMedia(filters)`
- `db.searchMediaByGenerationParams(params: { modelName?, prompt?, workflow?, loras?, cfgScaleMin?, cfgScaleMax?, stepsMin?, stepsMax? })`
- `db.searchMediaByLoRA(loraName: string)` - 特定LoRAを使用したメディアを検索（JSONB検索）

### 8. メディア情報編集機能

#### ファイル名変更仕様
- 実際のファイルシステムでもリネーム実行
- 重複時はエラーまたは自動リネーム
- DBのfile_pathとfile_nameを更新
- サムネイルキャッシュは既存のまま保持

#### タグ処理
- 新しいタグは自動でtagsテーブルに作成
- media_tagsテーブルは完全置換（既存削除→新規追加）

#### API関数
- `MediaService.updateMedia(sourceId: UUID, mediaId: UUID, mediaData: { filename?: string, description?: string, sourceUrl?: string, tags?: string[] })` (PUT用 - 完全更新)

#### DB関数
- `db.updateMedia(mediaId, ...)`

### 9. ディレクトリ管理機能

#### 対応範囲
- **Phase 1**: `type: 'local'` のみ対応
- **Phase 2**: SFTP/S3 対応予定

#### 削除処理詳細
1. 空でないディレクトリは `force: true` 必須
2. 削除対象メディアをDBから検索・削除
3. サムネイルキャッシュも連動クリーンアップ
4. 実際のディレクトリ削除実行

#### API関数
- `DirectoryService.getDirectoryTree(sourceId: UUID)`
- `DirectoryService.createDirectory(sourceId: UUID, directoryData: { path: string, name: string })`
- `DirectoryService.deleteDirectory(sourceId: UUID, directoryPath: string)`
- `DirectoryService.updateDirectory(sourceId: UUID, directoryData: { oldPath: string, newPath: string })`
- `DirectoryService.listMediaInSubdirectory(sourceId: UUID, directoriesPath: string)`

#### DB関数
- `db.selectMediaSourceById(sourceId)`
- `db.deleteMediaByPath(sourceId, directoryPath)`

### 10. カテゴリ管理機能

#### 概要
メディアを分類するためのカテゴリのCRUD操作を提供します。

#### API関数
- `CategoryService.getAllCategories()`
- `CategoryService.createCategory(categoryData: { name: string, description?: string, color?: string, parentId?: number })`
- `CategoryService.getCategoryDetails(categoryId: number)`
- `CategoryService.updateCategory(categoryId: number, categoryData: { name?: string, description?: string, color?: string, parentId?: number })`
- `CategoryService.deleteCategory(categoryId: number)`

#### DB関数
- `db.selectCategories()`
- `db.insertCategory(...)`
- `db.selectCategoryById(categoryId)`
- `db.updateCategory(categoryId, ...)`
- `db.deleteCategory(categoryId)`

### 11. キャラクター管理機能

#### 概要
メディアに登場するキャラクターのCRUD操作を提供します。キャラクターには別名（エイリアス）を設定でき、異なる表記での検索に対応します。

#### API関数
- `CharacterService.getAllCharacters()`
- `CharacterService.createCharacter(characterData: { name: string, ipId?: number, description?: string, aliases?: string[] })`
- `CharacterService.getCharacterDetails(characterId: number)`
- `CharacterService.updateCharacter(characterId: number, characterData: { name?: string, ipId?: number, description?: string, aliases?: string[] })`
- `CharacterService.deleteCharacter(characterId: number)`
- `CharacterService.searchCharacterByName(query: string)` - 名前とエイリアスの両方から検索

#### DB関数
- `db.selectCharacters()`
- `db.insertCharacter(data: { name: string, ipId?: number, description?: string, source?: string, aliases?: string[] })`
- `db.selectCharacterById(characterId)`
- `db.updateCharacter(characterId, updates: { name?, ipId?, description?, source?, aliases? })`
- `db.deleteCharacter(characterId)`
- `db.searchCharacterByAlias(alias: string)` - エイリアスからキャラクターを検索（JSONB検索）
- `db.selectCharactersByIp(ipId: number)` - 特定IPに属するキャラクター一覧

### 12. IP (知的財産) 管理機能

#### 概要
メディアが関連する作品やシリーズなどの知的財産（IP）のCRUD操作を提供します。

#### API関数
- `IpService.getAllIps()`
- `IpService.createIp(ipData: { name: string, description?: string })`
- `IpService.getIpDetails(ipId: number)`
- `IpService.updateIp(ipId: number, ipData: { name?: string, description?: string })`
- `IpService.deleteIp(ipId: number)`

#### DB関数
- `db.selectIps()`
- `db.insertIp(...)`
- `db.selectIpById(ipId)`
- `db.updateIp(ipId, ...)`
- `db.deleteIp(ipId)`

### 13. ユーザー管理機能

#### 概要
システムを利用するユーザーのCRUD操作を提供します。

#### API関数
- `UserService.getAllUsers()`
- `UserService.createUser(userData: { name: string, email: string, password?: string })`
- `UserService.getUserDetails(userId: UUID)`
- `UserService.updateUser(userId: UUID, userData: { name?: string, email?: string, password?: string })`
- `UserService.deleteUser(userId: UUID)`

#### DB関数
- `db.selectUsers()`
- `db.insertUser(...)`
- `db.selectUserById(userId)`
- `db.updateUser(userId, ...)`
- `db.deleteUser(userId)`

### 14. コレクション管理機能

#### 概要
ユーザーが作成するメディアのまとまり（コレクション）のCRUD操作と、コレクション内のメディア管理を提供します。

#### API関数
- `CollectionService.getAllCollections()`
- `CollectionService.createCollection(collectionData: { userId: UUID, name: string, description?: string })`
- `CollectionService.getCollectionDetails(collectionId: UUID)`
- `CollectionService.updateCollection(collectionId: UUID, collectionData: { userId?: UUID, name?: string, description?: string })`
- `CollectionService.deleteCollection(collectionId: UUID)`
- `CollectionService.addMediaToCollection(collectionId: UUID, mediaId: UUID, displayOrder?: number)`
- `CollectionService.removeMediaFromCollection(collectionId: UUID, mediaId: UUID)`

#### DB関数
- `db.selectCollections()`
- `db.insertCollection(...)`
- `db.selectCollectionById(collectionId)`
- `db.updateCollection(collectionId, ...)`
- `db.deleteCollection(collectionId)`
- `db.insertCollectionMedia(collectionId, mediaId, ...)`
- `db.deleteCollectionMedia(collectionId, mediaId)`

### 15. バルク操作機能

#### 概要
複数メディアの一括編集、削除、移動、タグ付けなど、効率的なメディア管理操作を提供します。AI生成情報やキャラクター情報の一括更新にも対応します。

#### API関数
- `BulkOperationService.bulkEditMedia(sourceId: UUID, mediaIds: UUID[], updates: any)`
- `BulkOperationService.bulkDeleteMedia(sourceId: UUID, mediaIds: UUID[])`
- `BulkOperationService.bulkMoveMedia(sourceId: UUID, mediaIds: UUID[], destinationPath: string)`
- `BulkOperationService.bulkTagMedia(sourceId: UUID, mediaIds: UUID[], tagsToAdd: number[], tagsToRemove: number[])`
- `BulkOperationService.bulkUpdateGenerationInfo(mediaIds: UUID[], updates: { modelName?, prompt?, negativePrompt?, loras?, vae? })` - AI生成情報の一括更新
- `BulkOperationService.bulkAssignCharacters(mediaIds: UUID[], characterIds: number[], confidence?: number)` - キャラクターの一括割り当て
- `BulkOperationService.bulkUpdateCharacterAliases(characterIds: number[], aliasesToAdd: string[], aliasesToRemove: string[])` - キャラクターエイリアスの一括更新

#### DB関数
- `db.bulkUpdateMedia(sourceId, mediaIds, updates)`
- `db.bulkDeleteMedia(sourceId, mediaIds)`
- `db.bulkUpdateMediaPaths(sourceId, mediaIds, newPaths)`
- `db.bulkAddMediaTags(sourceId, mediaIds, tagsToAdd)`
- `db.bulkRemoveMediaTags(sourceId, mediaIds, tagsToRemove)`
- `db.bulkUpdateMediaGenerationInfo(mediaIds, updates: { metadata?, prompt?, negativePrompt?, workflow?, loras?, vae?, hypernetworks?, embeddings?, modelName?, seed?, cfgScale?, steps? })`
- `db.bulkInsertMediaCharacters(mediaCharacterPairs: Array<{ mediaId: UUID, characterId: number, confidence?: number }>)`
- `db.bulkRemoveMediaCharacters(mediaIds, characterIds)`
- `db.bulkUpdateCharacterAliases(characterIds, aliasUpdates: Array<{ characterId: number, aliases: string[] }>)`

### 16. データ移行・同期機能

#### 概要
メディアソースのエクスポート、インポート、スキャン、複製など、データ移行と同期に関する機能を提供します。バックアップと同期の状態管理も含みます。

#### API関数
- `DataMigrationService.exportSource(sourceId: UUID, format: 'zip')`
- `DataMigrationService.importDataIntoSource(sourceId: UUID, importData: any)`
- `DataMigrationService.scanSource(sourceId: UUID)`
- `DataMigrationService.cloneSource(sourceId: UUID, newName: string)`
- `DataMigrationService.downloadMedia(sourceId: UUID, mediaId: UUID)`
- `SyncService.syncMediaToBackup(mediaId: UUID, backupUrl: string)` - メディアを指定バックアップ先に同期
- `SyncService.getSyncStatus(mediaId: UUID)` - 同期ステータスを取得
- `SyncService.retryFailedSync(mediaId: UUID)` - 失敗した同期を再試行

#### DB関数
- `db.selectMediaSourceData(sourceId)`
- `db.upsertMediaSourceData(sourceId, importData)`
- `db.selectMediaSourceById(sourceId)`
- `db.reconcileMediaSource(sourceId, fileSystemChanges)`
- `db.insertMediaSource(...)`
- `db.cloneMediaData(sourceId, newSourceId)`
- `db.selectMediaById(mediaId)`
- `db.selectMediaSyncByMediaId(mediaId)` - メディアの同期情報を取得
- `db.insertMediaSync(mediaId, syncData: { syncStatus?, backupUrls?, lastSyncedAt?, syncAttempts?, lastError? })`
- `db.updateMediaSyncStatus(mediaId, updates: { syncStatus?, backupUrls?, lastSyncedAt?, syncAttempts?, lastError? })` - 同期ステータスを更新
- `db.incrementSyncAttempts(mediaId)` - 同期試行回数をインクリメント
- `db.selectFailedSyncMedia()` - 同期失敗メディア一覧を取得
- `db.selectPendingSyncMedia()` - 同期待ちメディア一覧を取得

### 17. 内部ヘルパー関数 (Internal Helper Functions)

API関数やDB関数をサポートする、より低レベルの内部関数群です。

#### 17.1. ファイルシステム / ストレージドライバー
異なるストレージタイプ（ローカル、SFTP、S3）との対話を抽象化します。

- `LocalDriver.readFile(path: string)`
- `LocalDriver.writeFile(path: string, content: Buffer)`
- `LocalDriver.deleteFile(path: string)`
- `LocalDriver.listDirectory(path: string)`
- `LocalDriver.createDirectory(path: string)`
- `LocalDriver.deleteDirectory(path: string)`
- `LocalDriver.renamePath(oldPath: string, newPath: string)`
- `SftpDriver.connect(connectionInfo: SftpConnection)`
- `SftpDriver.readFile(connectionInfo: SftpConnection, remotePath: string)`
- `SftpDriver.writeFile(connectionInfo: SftpConnection, remotePath: string, content: Buffer)`
- `SftpDriver.deleteFile(connectionInfo: SftpConnection, remotePath: string)`
- `SftpDriver.listDirectory(connectionInfo: SftpConnection, remotePath: string)`
- `S3Driver.init(connectionInfo: S3Connection)`
- `S3Driver.getObject(connectionInfo: S3Connection, key: string)`
- `S3Driver.putObject(connectionInfo: S3Connection, key: string, content: Buffer)`
- `S3Driver.deleteObject(connectionInfo: S3Connection, key: string)`
- `S3Driver.listObjects(connectionInfo: S3Connection, prefix: string)`

#### 17.2. メディア処理 / 情報抽出
メディアファイル固有の処理（サムネイル生成、メタデータ抽出など）を行います。

- `ImageProcessor.generateThumbnail(mediaPath: string, outputPath: string, size: number)`
- `ImageProcessor.extractMetadata(mediaPath: string)`
- `ImageProcessor.getDimensions(mediaPath: string)`
- `VideoProcessor.generateThumbnail(videoPath: string, outputPath: string, time: string)`
- `VideoProcessor.extractMetadata(videoPath: string)`
- `AudioProcessor.generateWaveform(audioPath: string, outputPath: string)`
- `AudioProcessor.extractMetadata(audioPath: string)`

#### 17.3. データ変換 / 検証
データの整合性を確保し、異なる層（DB、APIレスポンス）向けにデータを準備します。

- `SchemaValidator.validate(schema: ZodSchema, data: any)`
- `DataTransformer.toApiResponse(dbRecord: any)`
- `DataTransformer.fromApiRequest(apiPayload: any)`

#### 17.4. ジョブキュー / バックグラウンド処理
サムネイル生成やSSE監視などの非同期タスクを管理します。

- `JobQueue.addThumbnailJob(mediaId: UUID, sourceId: UUID)`
- `JobQueue.processNextJob()`
- `SseManager.sendEvent(sourceId: UUID, eventType: string, data: any)`
- `SseManager.monitorFileSystem(sourceId: UUID, path: string)`

#### 17.5. ユーティリティ関数
一般的なヘルパー関数です。

- `PathUtils.resolveRelativePath(basePath: string, relativePath: string)`
- `PathUtils.getFileName(filePath: string)`
- `PathUtils.getFileExtension(filePath: string)`
- `HashUtils.generateMd5(filePath: string)`
- `HashUtils.generatePerceptualHash(filePath: string)`

### 18. 統計・分析機能

#### 概要
メディアの利用状況やシステム全体のパフォーマンスに関するデータ分析と監視機能を提供します。AI生成パラメータの統計やキャラクター出現頻度なども含みます。

#### API関数
- `AnalyticsService.getSourceStats(sourceId: UUID)`
- `AnalyticsService.getGlobalStats()`
- `AnalyticsService.getDuplicateMedia(sourceId: UUID)`
- `AnalyticsService.getSimilarMedia(sourceId: UUID, mediaPath: string)`
- `AnalyticsService.getPopularMedia()`
- `AnalyticsService.getModelUsageStats()` - 使用モデル別の統計
- `AnalyticsService.getLoRAUsageStats()` - LoRA使用頻度の統計
- `AnalyticsService.getCharacterStats()` - キャラクター別メディア数の統計
- `AnalyticsService.getGenerationParamsTrends()` - AI生成パラメータの傾向分析

#### DB関数
- `db.selectSourceStats(sourceId)`
- `db.selectGlobalStats()`
- `db.findDuplicateMedia(sourceId)`
- `db.findSimilarMedia(sourceId, mediaPath)`
- `db.selectPopularMedia()`
- `db.selectModelUsageStats()` - モデル名別メディア数を集計
- `db.selectLoRAUsageStats()` - LoRA名別使用回数を集計（JSONB集計）
- `db.selectCharacterFrequency()` - キャラクター別出現回数を集計
- `db.selectAverageGenerationParams()` - CFGスケール、ステップ数等の平均値を取得
- `db.selectPromptKeywords()` - プロンプトから頻出キーワードを抽出

### 17. 内部ヘルパー関数 (Internal Helper Functions)

API関数やDB関数をサポートする、より低レベルの内部関数群です。

#### 17.1. ファイルシステム / ストレージドライバー
異なるストレージタイプ（ローカル、SFTP、S3）との対話を抽象化します。

- `LocalDriver.readFile(path: string)`
- `LocalDriver.writeFile(path: string, content: Buffer)`
- `LocalDriver.deleteFile(path: string)`
- `LocalDriver.listDirectory(path: string)`
- `LocalDriver.createDirectory(path: string)`
- `LocalDriver.deleteDirectory(path: string)`
- `LocalDriver.renamePath(oldPath: string, newPath: string)`
- `SftpDriver.connect(connectionInfo: SftpConnection)`
- `SftpDriver.readFile(connectionInfo: SftpConnection, remotePath: string)`
- `SftpDriver.writeFile(connectionInfo: SftpConnection, remotePath: string, content: Buffer)`
- `SftpDriver.deleteFile(connectionInfo: SftpConnection, remotePath: string)`
- `SftpDriver.listDirectory(connectionInfo: SftpConnection, remotePath: string)`
- `S3Driver.init(connectionInfo: S3Connection)`
- `S3Driver.getObject(connectionInfo: S3Connection, key: string)`
- `S3Driver.putObject(connectionInfo: S3Connection, key: string, content: Buffer)`
- `S3Driver.deleteObject(connectionInfo: S3Connection, key: string)`
- `S3Driver.listObjects(connectionInfo: S3Connection, prefix: string)`

#### 17.2. メディア処理 / 情報抽出
メディアファイル固有の処理（サムネイル生成、メタデータ抽出など）を行います。

- `ImageProcessor.generateThumbnail(mediaPath: string, outputPath: string, size: number)`
- `ImageProcessor.extractMetadata(mediaPath: string)`
- `ImageProcessor.getDimensions(mediaPath: string)`
- `VideoProcessor.generateThumbnail(videoPath: string, outputPath: string, time: string)`
- `VideoProcessor.extractMetadata(videoPath: string)`
- `AudioProcessor.generateWaveform(audioPath: string, outputPath: string)`
- `AudioProcessor.extractMetadata(audioPath: string)`

#### 17.3. データ変換 / 検証
データの整合性を確保し、異なる層（DB、APIレスポンス）向けにデータを準備します。

- `SchemaValidator.validate(schema: ZodSchema, data: any)`
- `DataTransformer.toApiResponse(dbRecord: any)`
- `DataTransformer.fromApiRequest(apiPayload: any)`

#### 17.4. ジョブキュー / バックグラウンド処理
サムネイル生成やSSE監視などの非同期タスクを管理します。

- `JobQueue.addThumbnailJob(mediaId: UUID, sourceId: UUID)`
- `JobQueue.processNextJob()`
- `SseManager.sendEvent(sourceId: UUID, eventType: string, data: any)`
- `SseManager.monitorFileSystem(sourceId: UUID, path: string)`

#### 17.5. ユーティリティ関数
一般的なヘルパー関数です。

- `PathUtils.resolveRelativePath(basePath: string, relativePath: string)`
- `PathUtils.getFileName(filePath: string)`
- `PathUtils.getFileExtension(filePath: string)`
- `HashUtils.generateMd5(filePath: string)`
- `HashUtils.generatePerceptualHash(filePath: string)`
