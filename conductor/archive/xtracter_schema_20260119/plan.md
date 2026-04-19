# Plan: xtracterスキーマのBackupService準拠化と共通化

## Phase 1: サーバーサイドのスキーマ再構築

`src/domain/media/schemas.ts` を中心に、バックアップ形式とダウンロード形式の共通化を行います。

- [x] Task: 共通スキーマ `mediaDumpItemSchema` の定義
  - `src/domain/media/schemas.ts` に、`BackupService` のダンプ形式を表現するZodスキーマを作成する。
  - 全フィールド（`authors`, `tags`, `generationInfo` 等）を網羅する。
- [x] Task: ダウンロードスキーマ `downloadItemSchema` の再定義
  - `mediaDumpItemSchema` を継承(`extend`)し、`targetUrl`, `cookies`, `userAgent` を追加した定義に変更する。
- [x] Task: バリデーション更新の確認
  - `src/infrastructure/api/routers/downloads-router.ts` が新しいスキーマを参照していることを確認する。
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) [checkpoint: a8a0ea4]

## Phase 2: ダウンロードジョブの実装修正

新しいネストされたデータ構造を処理できるように、サーバー側のジョブロジックを修正します。

- [x] Task: `processDownloadJob` のロジック更新
  - `src/infrastructure/jobs/download-jobs.ts` を編集。
  - 入力データ型を新しい `DownloadItem` に変更。
  - `tweetText` -> `description` へのマッピング処理の削除（入力時点ですでに `description` になっているため）。
  - `authorName`/`authorId` -> `authors` 配列の処理への変更。
  - `tweetUrl` -> `sourceUrls` 配列の処理への変更。
  - `createdAt` の優先度処理の更新（入力値があればそれを使用）。
- [x] Task: ユニットテスト/動作確認（ジョブ単体）
  - 既存のテストがあれば修正、なければモックデータを用いた手動確認の準備。
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md) [checkpoint: 0e0b3a1]

## Phase 3: xtracter (拡張機能) の実装修正

拡張機能側のデータ抽出・送信ロジックを新スキーマに合わせます。

- [x] Task: 型定義の更新
  - `xtracter/src/types.ts` の `TweetMetadata` を、サーバー側の新スキーマに合わせて更新する（または `Shared` から型をインポートできるか検討するが、一旦は手動同期）。
- [x] Task: データ抽出ロジックの更新 (`content/index.ts`)
  - `extractMetadata` 関数を修正。
  - `authors` 配列の構築。
  - `sourceUrls` 配列の構築（`imageUrl` と `tweetUrl` を含める）。
  - `targetUrl` に `imageUrl` をセットする。
  - `description` に `tweetText` をセットする。
- [x] Task: 送信ロジックの確認 (`background/index.ts`)
  - 必要な変更があれば適用（基本的には型定義変更に伴うプロパティアクセスの修正のみのはず）。
- [x] Task: ビルドと動作確認
  - 拡張機能をビルドし、ブラウザで動作確認。
- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md) [checkpoint: 0300048]

## Phase 4: BackupServiceとの連携確認 (Optional/Cleanup)

`BackupService` 側でも共通スキーマを利用できないか検討・適用します。

- [x] Task: `BackupService` の型参照更新
  - `src/application/services/backup-service.ts` で、ハードコードされている型や `any` の部分を、可能な範囲で `mediaDumpItemSchema` (の型推論) に置き換える。
- [x] Task: 全体回帰テスト
  - ダウンロード機能が正常に動くか。
  - バックアップのリストアが（変更していれば）正常に動くか。
- [x] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md) [checkpoint: 6a96a81]
