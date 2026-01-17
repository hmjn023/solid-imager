# Specification: Xtracter Bulk Import & Preview

## 1. Overview
Browser Extension `xtracter` から、複数のメディア（画像・動画）のメタデータを一括で送信し、`solid-imager` 側でプレビュー・選別した上でインポート（ダウンロード）を実行する機能を実装する。
データ形式は `BackupService` のJSONスキーマに準拠させ、タグやAuthor情報のリッチな連携を可能にする。

## 2. Functional Requirements

### 2.1 Data Schema Alignment
- **Concept:** `xtracter` の出力JSONスキーマを `BackupService` の `restoreSource` ロジックが受け取れる形式（サブセット）に合わせる。
- **Fields:**
    - 基本情報: `imageUrl`, `tweetUrl` (sourceUrls), `description` (tweetText)
    - **拡張フィールド:**
        - `tags`: `{ name: string, type: 'positive' | 'negative' }[]`
        - `authors`: `{ name: string, accountId?: string }[]`
- **Constraint:** `id`, `filePath`, `fileSize` など、ダウンロード前に未確定なフィールドは `null` または省略可能とする。

### 2.2 Bulk Import API (ORPC)
- **Endpoint:** `downloads.preview` (新規作成)
- **Input:** `BackupService` 互換のメディア情報リスト（JSON）。
- **Behavior:**
    - 受け取ったJSONデータを `jobs` テーブル（または一時ストア）に「承認待ち (pending_approval)」ステータスで保存する。
    - 保存したジョブのIDを返す。

### 2.3 Preview UI
- **Trigger:** ユーザーが `xtracter` から送信操作を行った後、`solid-imager` のUIでアクション（通知クリックやメニュー選択）を起こすとモーダルが開く。
- **Interface (Modal):**
    - 送信されたメディアのリストを表示（サムネイルはURLから直接ロード）。
    - 各アイテムについて「インポート対象にするか」のチェックボックス（デフォルトON）。
    - タグやAuthor情報の簡易表示。
- **Action:**
    - 「Import Selected」ボタン押下で、選択されたアイテムに対して既存の `downloads.start` 相当の処理（キューイング）を実行する。

### 2.4 Xtracter Update
- **UI:** ポップアップ内に「Send to Imager」ボタンを追加。
- **Logic:** 表示中のタイムライン/ページからメタデータを収集し、新スキーマに変換してORPC経由で送信する。

## 3. Non-Functional Requirements
- **Performance:** 数百件程度のアイテムを一括送信してもUIがフリーズしないこと。
- **Compatibility:** 既存の `BackupService` のロジックを最大限再利用し、二重管理を防ぐ。

## 4. Acceptance Criteria
- [ ] `xtracter` からタグ付きのメタデータJSONを送信できること。
- [ ] `solid-imager` 側で、送信されたデータのプレビューモーダルが表示されること。
- [ ] プレビューモーダルでアイテムの取捨選択ができること。
- [ ] 選択したアイテムが正しくダウンロード・保存され、タグやAuthor情報がDBに反映されること。

## 5. Out of Scope
- インポート確認画面での詳細なメタデータ編集機能（リネームなどはインポート後に行う）。
- `BackupService` 自体の完全なリファクタリング（今回はインポート機能の利用に留める）。
