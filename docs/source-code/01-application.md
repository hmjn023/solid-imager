# アプリケーション層 (`src/application`)

このドキュメントでは、`src/application`ディレクトリ、特に`services`配下の各サービスの役割と実装状況について解説します。

アプリケーション層は、ドメイン層のエンティティやロジックを使い、具体的なユースケースを実現する責務を持ちます。

## サービス一覧

### `analytics-service.ts`

-   **役割**: メディアに関する統計・分析機能を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `getSourceStats`: 特定ソースの統計取得
    -   `getGlobalStats`: 全体統計の取得
    -   `getDuplicateMedia`: 重複メディアの検出
    -   `getSimilarMedia`: 類似メディアの検索
    -   `getPopularMedia`: 人気メディアの取得

### `bulk-operation-service.ts`

-   **役割**: 複数のメディアに対する一括操作（編集、削除、移動、タグ付け）を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `bulkEditMedia`: 一括編集
    -   `bulkDeleteMedia`: 一括削除
    -   `bulkMoveMedia`: 一括移動
    -   `bulkTagMedia`: 一括タグ付け

### `category-service.ts`

-   **役割**: カテゴリのCRUD（作成、読み取り、更新、削除）操作を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `getAllCategories`: 全カテゴリ取得
    -   `createCategory`: カテゴリ作成
    -   `getCategoryDetails`: カテゴリ詳細取得
    -   `updateCategory`: カテゴリ更新
    -   `deleteCategory`: カテゴリ削除

### `character-service.ts`

-   **役割**: キャラクターのCRUD操作を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `getAllCharacters`: 全キャラクター取得
    -   `createCharacter`: キャラクター作成
    -   `getCharacterDetails`: キャラクター詳細取得
    -   `updateCharacter`: キャラクター更新
    -   `deleteCharacter`: キャラクター削除

### `collection-service.ts`

-   **役割**: メディアコレクションの管理機能を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `getAllCollections`: 全コレクション取得
    -   `createCollection`: コレクション作成
    -   `getCollectionDetails`: コレクション詳細取得
    -   `updateCollection`: コレクション更新
    -   `deleteCollection`: コレクション削除
    -   `addMediaToCollection`: コレクションへのメディア追加
    -   `removeMediaFromCollection`: コレクションからのメディア削除

### `config-service.ts`

-   **役割**: アプリケーション設定 (`config.json`) の読み書きを管理します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `getAppConfig`: 設定取得
    -   `updateAppConfig`: 設定更新
    -   `resetAppConfig`: 設定リセット

### `data-migration-service.ts`

-   **役割**: データのエクスポート、インポート、スキャン、複製などのデータ移行機能を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `exportSource`: エクスポート
    -   `importDataIntoSource`: インポート
    -   `scanSource`: スキャンと調整
    -   `cloneSource`: 複製
    -   `downloadMedia`: メディアダウンロード

### `directory-service.ts`

-   **役割**: メディアソース内のディレクトリ操作（ツリー取得、作成、削除、リネーム）を提供します。
-   **実装状況**: **一部実装**
    -   `getDirectoryTree`: **未実装**
    -   `createDirectory`: **未実装**
    -   `deleteDirectory`: **未実装**
    -   `updateDirectory`: **未実装**
    -   `listMediaInSubdirectory`: **実装済み** (指定ディレクトリ内のメディアとサブディレクトリを一覧表示)

### `event-service.ts`

-   **役割**: SSE (Server-Sent Events) によるリアルタイム更新機能を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `startSseMonitoring`: ファイルシステム監視開始
    -   `getThumbnailProgressEvents`: サムネイル生成進捗のイベント取得

### `filter-preset-service.ts`

-   **役割**: 検索条件のプリセット管理機能を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `getPresets`: プリセット一覧取得
    -   `savePreset`: プリセット保存

### `integration-service.ts`

-   **役割**: ComfyUIやDiscordなどの外部サービスとの連携機能を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `uploadToComfyUi`: ComfyUIへのアップロード
    -   `getComfyUiWorkflows`: ComfyUIワークフロー取得
    -   `sendDiscordNotification`: Discord通知送信

### `ip-service.ts`

-   **役割**: IP（知的財産）のCRUD操作を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `getAllIps`: 全IP取得
    -   `createIp`: IP作成
    -   `getIpDetails`: IP詳細取得
    -   `updateIp`: IP更新
    -   `deleteIp`: IP削除

### `media-service.ts`

-   **役割**: メディアに関する主要機能（配信、メタデータ、アップロード、検索、編集）を提供します。
-   **実装状況**: **一部実装** (大半がプレースホルダー)
    -   `getMediaContent`: **実装済み** (メディアのファイル内容を取得して配信)
    -   `getMediaMetadata`: **未実装**
    -   `updateMediaMetadata`: **未実装**
    -   `uploadNewMedia`: **未実装**
    -   `searchMedia`: **未実装**
    -   `searchMediaInDirectory`: **実装済み** (ダミーデータを返すプレースホルダー実装)
    -   `updateMedia`: **未実装**
    -   `getRandomMedia`: **未実装**
    -   `getRecentMedia`: **未実装**

### `media-source-service.ts`

-   **役割**: メディアソースのCRUD操作を提供します。サーバーサイドで実行される関数群です。
-   **実装状況**: **実装済み**
    -   `fetchSources`: 全ソース取得
    -   `createSource`: ソース作成
    -   `updateSource`: ソース更新
    -   `fetchSourceById`: IDによるソース取得
    -   `deleteSource`: ソース削除

### `search-service.ts`

-   **役割**: すべてのメディアソースを横断するグローバル検索機能を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `globalSearchMedia`: グローバル検索実行

### `thumbnail-service.ts`

-   **役割**: サムネイルの生成管理とURL構築を提供します。
-   **実装状況**: **一部実装**
    -   `getAllThumbnailLinks`: **未実装** (プレースホルダー)
    -   `getMediaThumbnail`: **実装済み** (URLを構築して返す)
    -   `startThumbnailGeneration`: **実装済み** (APIクライアントを呼び出す)
    -   `clearThumbnailCache`: **実装済み** (APIクライアントを呼び出す)

### `user-service.ts`

-   **役割**: ユーザー管理機能を提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `getAllUsers`: 全ユーザー取得
    -   `createUser`: ユーザー作成
    -   `getUserDetails`: ユーザー詳細取得
    -   `updateUser`: ユーザー更新
    -   `deleteUser`: ユーザー削除

### `workflow-service.ts`

-   **役割**: バックグラウンドジョブの管理や自動化ワークフローを提供します。
-   **実装状況**: **未実装** (すべてプレースホルダー)
    -   `getJobList`: ジョブ一覧取得
    -   `cancelJob`: ジョブのキャンセル
    -   `autoTagMedia`: AIによる自動タグ付け実行

## テスト

アプリケーション層のサービスに関するテストは、主にユニットテストとして実装されます。データベースや外部APIなどのインフラストラクチャ層はモック化され、サービスのビジネスロジックが正しく動作するかを独立して検証します。

詳細は[テスト (`src/tests`)](./05-testing.md)のドキュメントを参照してください。