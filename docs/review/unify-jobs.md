# メディア処理ジョブ統合の要件定義と設計

## 1. はじめに

本ドキュメントは、現在システム内で分散しているメディア処理（ダウンロード、検知、サムネイル生成、DB登録など）を一元化し、保守性と拡張性を向上させるための要件定義および設計書です。

## 2. 現状調査 (Current Status Analysis)

コードベースの調査により、以下の現状が明らかになりました。

### 2.1 分散したメディア登録フロー
現在、メディアがシステムに追加される経路は大きく4つあり、それぞれが独自の実装を持っています。

1.  **メディアダウンロード (`DownloadJobs`)**
    *   **実装**: `src/infrastructure/jobs/download-jobs.ts`
    *   **フロー**: ダウンロード実行 -> `MediaRepository.create` -> `MediaRepository.addUrls` -> `AuthorRepository.create` -> `AuthorRepository.addMedia` -> `thumbnail` ジョブ投入 -> SSE通知。
    *   **問題**: メディアファイル自体の保存だけでなく、AuthorやSourceURLといった関連情報の保存もこのレイヤーで同期的に行われている。`FileWatcherService` との競合（Race Condition）を防ぐために `try-catch` で既存チェックを行うなど、複雑化している。

2.  **ファイル監視 (`FileWatcherService`)**
    *   **実装**: `src/infrastructure/jobs/file-watcher-service.ts`
    *   **フロー**: `chokidar` 検知 -> `MediaRepository.create` -> `thumbnail` & `extractTags` ジョブ投入 -> **同期的に `ImageProcessor.extractMetadata` を実行**。
    *   **問題**: ジョブキューに入れているにもかかわらず、その場で重い処理（メタデータ抽出）を実行している箇所があり、非効率。また、ダウンロード処理とロジックが重複している。

3.  **手動アップロード (`MediaService`)**
    *   **実装**: `src/application/services/media-service.ts` (`uploadMedia`)
    *   **フロー**: ファイル保存 -> `MediaRepository.upsert` -> (`addUrls`) -> `thumbnail` & `extractTags` ジョブ投入。
    *   **問題**: 独自にジョブ投入を行っており、他のフローとコードが重複している。

4.  **Zipインポート / 既存登録 (`BackupService`, `MediaService`)**
    *   **実装**: `src/application/services/backup-service.ts`, `src/application/services/media-service.ts`
    *   **フロー**: 展開/スキャン -> DB登録 -> まとめてジョブ投入。

### 2.2 ジョブ管理の実態
*   **実装**: `src/infrastructure/jobs/job-manager.ts`
*   **状態**: 完全なインメモリ実装 (`Map` オブジェクト使用)。
*   **リスク**: サーバー再起動により、未処理のジョブは全て消失します。「ジョブの登録漏れが多い」という課題の一部は、この永続化されていない性質に起因する可能性があります。

## 3. 要件定義 (Requirements)

### 3.1 統一エントリーポイントの確立
*   どのような経路（アップロード、ダウンロード、インポート、監視検知）であっても、メディア登録処理は**単一のサービスメソッド**を経由すること。
*   呼び出し元は「ファイルパス」と「ソースID」に加え、オプションで「**初期メタデータ（コンテキスト情報）**」を渡せるようにする。

### 3.2 スキーマの再編と共通化
`MediaDumpItem` はバックアップ用途の色が強いため、より汎用的な構造へリファクタリングを行う。

*   **`MediaMetadataContext` (Base Schema)**:
    *   ファイル実体以外のメタデータ（Author, Tags, URL, Description, Characters, IPs, Projects, GenerationInfo）。
    *   これを `MediaProcessingService` の共通インターフェースとして使用する。
*   **`MediaDumpItem` (for Backup/Restore)**:
    *   `MediaMetadataContext` を継承。
    *   物理ファイル情報 (`filePath`, `fileName`, `fileSize`, `createdAt`...) を追加。
*   **`DownloadItem` (for Download/Xtracter)**:
    *   `MediaMetadataContext` を継承。
    *   ダウンロード制御情報 (`targetUrl`, `cookies`, `userAgent`) を追加。
    *   *変更点*: 以前は `MediaDumpItem` を継承していたため不要なファイル情報を持っていたが、これを解消する。

### 3.3 ジョブ定義の完全統合（単一ジョブ化）
*   **変更**: `thumbnail`, `extractTags` などの個別ジョブを廃止し、**`processMedia`** という**単一のジョブタイプ**に統合する。
*   **目的**: 処理の原子性を高め、部分的な実行漏れや順序の不整合（例：サイズ取得前にサムネイル生成など）を防ぐ。

### 3.4 責務の分離（同期 vs 非同期）
*   **同期処理 (`registerAndProcess` 内)**:
    *   「既に手元にある確定した情報」（Author, SourceURL, ユーザー指定のDescription, Tagsなど）のDB登録。
    *   これはUXのため即時反映させる。
*   **非同期ジョブ (`processMedia` 内)**:
    *   「これから計算・解析が必要な情報」（Width/Height, Exif解析, サムネイル生成, AIタグ）の処理。

### 3.5 エラーハンドリング戦略
*   **方針**: 各処理ステップは**独立して実行**し、個別の失敗がジョブ全体を停止させない。
*   **部分失敗の許容**: メタデータ抽出が失敗してもサムネイル生成は続行する。AIタグ付けが失敗してもメディア登録自体は成功とする。
*   **手動再実行対応**: 失敗したステップは、UIから個別に再実行できるようにAPIエンドポイントを用意する（例: `POST /media/:id/regenerate-thumbnail`）。
*   **ロギング**: 各ステップの成功/失敗をログに記録し、デバッグを容易にする。

## 4. 詳細設計 (Detailed Design)

### 4.1 新規コンポーネント: `MediaProcessingService`

`MediaService` から処理ロジックを切り出し、以下の責務を持つサービスを新設します。

```typescript
import type { MediaMetadataContext } from "~/domain/media/schemas";

interface MediaProcessingService {
  /**
   * メディア処理の統一エントリポイント
   * 1. DBへの初期登録（基本情報 + Contextに含まれるメタデータの保存）
   * 2. 単一の処理ジョブ(processMedia)をキューイング
   * 
   * @param mediaSourceId ソースID
   * @param relativePath ソースルートからの相対パス
   * @param contextMetadata 外部から提供される初期メタデータ（共通基底スキーマ）
   */
  registerAndProcess(
    mediaSourceId: string, 
    relativePath: string, 
    contextMetadata?: Partial<MediaMetadataContext>
  ): Promise<Media>;
  
  /**
   * 実際のジョブ実行ロジック（Workerから呼ばれる）
   * 単一の関数内で全ステップを順次実行する。
   */
  executeProcessMediaJob(job: Job): Promise<void>;
}
```

### 4.2 スキーマ構造の変更

`src/domain/media/schemas.ts` を以下のように変更します。

```typescript
// 1. 基底スキーマ: 純粋なメタデータ
export const mediaMetadataContextSchema = z.object({
  description: z.string().nullable().optional(),
  sourceUrls: z.array(z.string().url()).optional(),
  authors: z.array(z.object({...})).optional(),
  tags: z.array(z.object({...})).optional(),
  characters: z.array(z.object({...})).optional(),
  ips: z.array(z.object({...})).optional(),
  projects: z.array(z.object({...})).optional(),
  generationInfo: z.object({...}).nullable().optional(),
});
export type MediaMetadataContext = z.infer<typeof mediaMetadataContextSchema>;

// 2. バックアップ用（ファイル情報含む）
export const mediaDumpItemSchema = mediaMetadataContextSchema.extend({
  id: z.string().optional(),
  filePath: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  mediaType: z.enum([...]).optional(),
  createdAt: z.coerce.date().optional(),
  modifiedAt: z.coerce.date().optional(),
});

// 3. ダウンロード用
export const downloadItemSchema = mediaMetadataContextSchema.extend({
  targetUrl: z.string().url(),
  cookies: z.array(z.any()).optional(),
  userAgent: z.string().optional(),
});
```

### 4.3 ジョブ定義の変更 (`JobManager`)

`src/infrastructure/jobs/job-manager.ts` の `Job` 型定義を変更し、単一タイプにします。

```typescript
export type Job = {
  mediaId: string;
  sourcePath: string;
  type: "processMedia"; // 統合された単一タイプ
  // ..
};
```

**処理フローイメージ (`executeProcessMediaJob`):**

各ステップは独立して実行し、個別の失敗がジョブ全体を停止させません。

```typescript
async function executeProcessMediaJob(job: Job) {
  // Step 1: メタデータ抽出 (Image/Video Metadata, ComfyUI info)
  // 失敗してもサムネイル生成には影響しない
  try {
    const metadata = await extractMetadata(job.sourcePath);
    await updateMediaMetadata(job.mediaId, metadata);
  } catch (e) {
    logger.warn({ err: e, mediaId: job.mediaId }, 'Metadata extraction failed, continuing...');
  }
  
  // Step 2: サムネイル生成
  // 失敗した場合はUIに影響するが、メディア登録自体は成功扱い
  try {
    await generateThumbnail(job.sourcePath, job.mediaId);
  } catch (e) {
    logger.error({ err: e, mediaId: job.mediaId }, 'Thumbnail generation failed');
  }
  
  // Step 3: AIタグ付け (オプショナル)
  // 現時点ではconfigを登録、読み込みする機能は存在しないため、定数で制御する (default: false)
  if (ENABLE_AUTO_TAGGING) {
    try {
      await extractAiTags(job.sourcePath, job.mediaId);
    } catch (e) {
      logger.warn({ err: e, mediaId: job.mediaId }, 'AI tagging failed, skipping');
    }
  }
}
```

**手動再実行用oRPCプロシージャ（将来実装）:**

```typescript
// media.regenerateThumbnail({ mediaId: string })
// media.extractMetadata({ mediaId: string })
// media.extractTags({ mediaId: string })
```

### 4.4 実装ステップ (Implementation Plan)

段階的移行により、既存コード（特に `BackupService`）への影響を最小化します。

1.  **Step 0: `MediaProcessingService` のスカフォールディング** (既存コードに影響なし)
    *   `src/application/services/media-processing-service.ts` を新規作成。
    *   `registerAndProcess` メソッドのスタブ実装。
    *   **検証**: `bun run check` が通ること。既存動作に影響がないこと。

2.  **Step 1: スキーマの「追加」** (破壊的変更なし)
    *   `src/domain/media/schemas.ts` に `MediaMetadataContext` を**新規追加**。
    *   既存の `MediaDumpItem`, `DownloadItem` は維持し、内部で `MediaMetadataContext` を利用するように段階的に調整。
    *   **検証**: `bun run test` が通ること。`BackupService` が正常に動作すること。

3.  **Step 2: `MediaProcessingService` の本実装**
    *   `registerAndProcess` メソッドの実装（関連データ登録ロジックの集約）。
    *   `executeProcessMediaJob` の実装（独立実行 + ログ記録）。
    *   **検証**: 単体テストを作成し、Mock検証する。

4.  **Step 3: 呼び出し元の段階的移行**
    *   `download-jobs.ts`: 新サービス呼び出しへ変更。テスト実行で確認。
    *   `file-watcher-service.ts`: 新サービス呼び出しへ変更。テスト実行で確認。
    *   `media-service.ts`: 新サービス呼び出しへ変更。テスト実行で確認。

5.  **Step 4: `JobManager` のリファクタリング**
    *   ジョブタイプを `processMedia` のみに統合。
    *   旧ジョブタイプ (`thumbnail`, `extractTags`) は deprecated コメント追加（即削除しない）。

6.  **Step 5: 統合テストと検証**
    *   ダウンロードジョブを実行し、DBを確認。**Author, SourceURL, Tag 等が欠落なく保存されていること**を確認する。
    *   `FileWatcher` で新規ファイルを検出し、サムネイル生成とメタデータ抽出が完了することを確認する。
    *   部分失敗時にジョブ全体が停止しないことを確認する。

7.  **Step 6: (後日) クリーンアップ**
    *   旧ジョブタイプの完全削除。
    *   `BackupService` の `MediaDumpItem` 参照を `MediaMetadataContext` ベースに移行（任意）。