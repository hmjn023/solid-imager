# Xtracter Bulk Processing

xtracterのjsonを吐き出す機能と同様の方法でタイムライン上にあるメディアを検知し、一括でxtracterでsolid-imagerに転送
solid-imager側でモーダルでメディアのプレビューを表示し、受け入れるメディアを選択しソースに取り込む

## データフロー

1.  **Xtracter (Extension)**
    *   ページ上のメディア情報（画像および**動画**）を収集し、`DownloadItem` 形式のリストを作成。
    *   API `POST /api/rpc/imports.bulkAdd` に送信。
2.  **Solid Imager (Backend)**
    *   受け取った各アイテムについて、処理種別を自動判定。
        *   **A. 復元 (Restore):** `filePath` があり、かつサーバー上に実ファイルが存在する場合 → メタデータ復元処理を実行（既存のBackupServiceロジック）。
        *   **B. ダウンロード (Import/Download):** 上記以外で `targetUrl` がある場合 → `jobs` テーブルに `type: 'import_request'` として保存。ステータス `pending`。
    *   SSEでクライアントに「インポート待ち」通知を送信。
3.  **Solid Imager (Frontend)**
    *   ヘッダーの「インポート待ち」インジケータが更新。
    *   ユーザーが承認モーダルを開き、プレビュー画像を確認して選択。
    *   承認されたアイテムを `POST /api/rpc/imports.process` に送信。
4.  **Solid Imager (Backend - Processing)**
    *   承認されたアイテムに対して `queueDownloadJobs` を実行。
    *   動画URL (`targetUrl`) の場合、サーバー側の `yt-dlp` 連携により自動的に動画として処理される。
    *   元の `import_request` ジョブを `completed` に更新。

## スキーマ定義

### 共通アイテムスキーマ (`DownloadItem` / `MediaDumpItem`)
`MediaMetadataContext` をベースにした共通構造を利用し、用途によってフィールドを使い分ける。

```typescript
type DownloadItem = {
    // --- ダウンロード用 (Import) ---
    targetUrl: string;       // 実体URL (画像直リンク) または 処理対象URL (動画ツイートURL)
    cookies?: any[];         // 動画DL用クッキー
    userAgent?: string;      // リクエスト用UA

    // --- バックアップ復元用 (Restore) ---
    filePath?: string;       // 既存ファイルパス (存在チェックに使用)
    fileName?: string;       // ファイル名
    
    // --- 共通メタデータ ---
    sourceUrls: string[];    // 出典URLリスト（重複チェック、Source URL登録に使用）
    description?: string;
    createdAt?: Date;
    tags?: { name: string; type: "positive"|"negative" }[];
    authors?: { name: string; accountId?: string }[];
    projects?: { name: string }[];
    characters?: { name: string }[];
    ips?: { name: string }[];
    generationInfo?: { ... };
}
```

### URLの識別と動画対応
*   **画像:** `targetUrl` に画像の直リンクを設定。
*   **動画:** `targetUrl` に**ツイート自体のURL**（または動画ページURL）を設定。
    *   Solid Imagerのダウンローダーは、URLパターンから自動的に `yt-dlp` の使用を判断する。
*   **Source URL:** `sourceUrls` には常に「投稿ページ（ツイート）のURL」を含める。重複チェックは主にこれを用いる。

## 重複チェック仕様
*   `imports.bulkAdd` 受信時、`sourceUrls` に含まれるURLが既に `media_urls` テーブルに存在する場合、そのアイテムは**自動的にスキップ**する（インポートキューに入れない）。

## 実装タスク

### 1. Solid Imager (Backend)
*   `imports` ルーター実装
    *   `bulkAdd`: 自動判定ロジック（復元 vs ダウンロード登録）の実装。
    *   `listPending`: `jobs` からインポート待ちリスト取得。
    *   `process`: 選択アイテムの `queueDownloadJobs` 呼び出し。
*   `jobs` テーブル活用: `type: 'import_request'` の運用。

### 2. Xtracter (Extension)
*   **動画検知ロジックの修正**:
    *   現在 `processedMetadata` に動画（`videoComponent`）が追加されていない問題を修正。
    *   動画の場合、`targetUrl` にツイートURLを設定するように統一。
*   **Bulk Upload UI**:
    *   Popupにアップロードボタン追加。
    *   `POST /api/rpc/imports.bulkAdd` への送信処理。

### 3. Solid Imager (Frontend)
*   インポート待ちインジケータ（ヘッダー）。
*   一括インポートモーダル。
    *   `targetUrl` を使ったプレビュー表示（動画の場合はサムネイル画像があればそれを、なければプレースホルダーかiframe検討 ※まずは画像メインでOK）。

# Xtracter 一括処理 実装計画

本書は、XtracterからSolid Imagerへメディア（画像・動画）を一括インポートし、レビューを経て取り込む機能の詳細な実装計画書です。

## 1. バックエンド実装 (Solid Imager)

### 1.1. `imports` ルーター (`src/infrastructure/api/routers/imports-router.ts`)

一括インポート要求を処理する新しいルーターを作成します。

**主要プロシージャ:**

*   **`bulkAdd`**:
    *   **入力**: `z.object({ items: z.array(downloadItemSchema) })`
    *   **ロジック**:
        1.  `items` を反復処理。
        2.  **重複チェック**: `sourceUrls` を抽出し、`media_urls` テーブルを照会してURLが既に存在するか確認。
            *   存在する場合: そのアイテムをスキップ。
        3.  **アクション判定**:
            *   `filePath` が存在し、かつディスク上に実ファイルがある場合:
                *   アクション: **復元 (Restore)**。
                *   ロジック: `BackupService.restoreItem()` (または既存ファイルのメタデータ登録ロジック) を呼び出し。
            *   上記以外で `targetUrl` が存在する場合:
                *   アクション: **インポート要求 (Import Request)**。
                *   ロジック: `jobs` テーブルに挿入:
                    *   `type`: `'import_request'`
                    *   `status`: `'pending'`
                    *   `payload`: `DownloadItem` のJSONシリアライズ。
        4.  **通知**: SSEイベント `import-request:created` を発行し、フロントエンドのインジケータを更新。
    *   **出力**: `{ addedCount: number, skippedCount: number, restoredCount: number }`

*   **`listPending`**:
    *   **入力**: なし (またはページネーションパラメータ)
    *   **ロジック**: `jobs` テーブルから `type = 'import_request'` かつ `status = 'pending'` のものを検索。
    *   **出力**: ジョブのリスト（`payload` を `DownloadItem` にマッピングし、`jobId` を付与）。

*   **`process`**:
    *   **入力**: `z.object({ jobIds: z.array(z.string().uuid()), targetSourceId: z.string().uuid() })`
    *   **ロジック**:
        1.  指定されたジョブを取得。
        2.  `payload` (DownloadItem) を `queueDownloadJobs` (画像の場合) または標準のメディア登録処理の入力に変換。
            *   **注記**: `src/infrastructure/jobs/download-jobs.ts` を再利用。これは `targetUrl` (画像 vs 動画URL) を適切に処理する。
        3.  ジョブのステータスを `'completed'` に更新。
        4.  SSEイベント `import-request:processed` を発行。
    *   **出力**: `{ success: true, processedCount: number }`

*   **`cancel`**:
    *   **入力**: `z.object({ jobIds: z.array(z.string().uuid()) })`
    *   **ロジック**: 指定されたジョブを削除、またはステータスを `'failed'`/`'canceled'` に更新。
    *   **出力**: `{ success: true }`

### 1.2. API コントラクト (`src/domain/shared/api-contract.ts`)

*   `importsRouter` を登録。

### 1.3. サービス統合

*   `src/infrastructure/jobs/download-jobs.ts` の `queueDownloadJobs` が、Xtracterからのリッチなメタデータ（Author, Tagsなど）を受け取れることを確認。
    *   *実装時の確認事項*: 現在のダウンロードジョブペイロードは完全なメタデータの受け渡しをサポートしているか？ (おそらく `MediaMetadataContext` 経由で可能)

## 2. 拡張機能実装 (Xtracter)

### 2.1. コンテンツスクリプト (`xtracter/src/content/index.ts`)

*   **修正**: 動画処理ループ内で、メタデータを `processedMetadata` マップに追加するように修正。
    ```typescript
    // 動画ループ内:
    if (metadata.targetUrl && !processedMetadata.has(metadata.targetUrl)) {
        processedMetadata.set(metadata.targetUrl, metadata);
    }
    ```
*   **検証**: 動画の `targetUrl` がツイートURLになっていることを確認（サーバーサイドで `yt-dlp` が処理できるようにするため）。

### 2.2. ポップアップ UI (`xtracter/src/popup/App.tsx`)

*   「Solid Imagerへ一括アップロード」ボタンを追加。
*   **ロジック**:
    1.  アクティブなタブに `GET_METADATA` メッセージを送信。
    2.  `DownloadItem` のリストを受信。
    3.  `http://localhost:3000/api/rpc/imports.bulkAdd` へPOSTリクエスト送信。
    4.  成功/エラーのトーストを表示。

### 2.3. バックグラウンドスクリプト (`xtracter/src/background/index.ts`)

*   必要であれば `POST_BULK` メッセージを処理（またはPopupで直接処理）。ローカル拡張機能ならPopupからの直接fetchがシンプルだが、CORS等の問題があればBackgroundで処理。 *決定: まずはPopupで実装を試みる。*

## 3. フロントエンド実装 (Solid Imager)

### 3.1. ストア / 状態管理

*   複雑なグローバルストアは不要。モーダル内で `createResource` を使用して保留中のインポートを取得。
*   ヘッダーの「保留中インポート数」用シグナル（RPCで取得 + SSEで更新）。

### 3.2. ヘッダーインジケータ (`src/presentation/components/layout/Header.tsx`)

*   アイコン（例: `InboxIcon`）を追加し、保留中のインポートジョブ数をバッジで表示。
*   クリックで **インポートレビューモーダル** を開く。

### 3.3. インポートレビューモーダル (`src/presentation/components/imports/ImportReviewModal.tsx`)

*   **レイアウト**:
    *   保存先ソース選択ドロップダウン。
    *   保留中アイテムのグリッド表示。
    *   **アイテムカード**:
        *   プレビュー画像（画像の場合は `targetUrl` を使用、動画の場合はサムネイルがなければプレースホルダー/アイコンを検討）。
        *   メタデータ概要（Author, Tags）。
        *   チェックボックス（デフォルトで選択）。
    *   **アクション**: 「選択した項目をインポート」、「選択した項目を削除」、「キャンセル」。

## 4. 実装ステップ

1.  **バックエンド**: `imports` ルーター実装 & APIコントラクト登録。
2.  **拡張機能**: 動画メタデータバグ修正 & 一括アップロードボタン実装。
3.  **フロントエンド**: ヘッダーインジケータ & レビューモーダル実装。
4.  **統合テスト**: Twitter -> Xtracter -> Solid Imager レビュー -> ダウンロード -> 完了 のフローテスト。

