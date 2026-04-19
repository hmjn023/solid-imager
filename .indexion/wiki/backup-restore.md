# バックアップ / リストア

メディアソースのエクスポート・インポート機能。`apps/server` と `apps/tauri` 両方に実装されている。

## バックアップ形式

ZIP形式。メタデータJSONと実ファイルを同梱:

```
backup.zip
├── dump.json       ← メタデータ（タグ・キャラクター・プロンプト等）
└── images/
    ├── photo1.jpg
    └── photo2.png
```

`dump.json` の各エントリは `MediaDumpItem` スキーマ（`packages/core/src/domain/media/schemas.ts`）に準拠。

## Server側（`apps/server/src/application/services/backup-service.ts`）

### ダンプ（エクスポート）

```
GET /api/sources/:mediaSourceId/dump
```

`BackupService` が対象ソースのメディアを全件走査し、関連するタグ・キャラクター・IP・作者・プロンプト情報をJSON化してZIPストリームで返す。実ファイルもZIPに同梱。

### インポート

```
POST /api/sources/:mediaSourceId/import
```

ZIPをアップロードすると `BackupService` がバックグラウンドで処理:
1. `dump.json` をパース・バリデーション（`mediaDumpItemSchema`）
2. タグ・キャラクター・IP・作者をマスターテーブルへ upsert（`source: "restored"` で記録）
3. メディアレコードを挿入・関連データを復元
4. サムネイル生成ジョブをキューへ投入

**セキュリティ**: ZIPエントリのパスを `validateRelativePath()` でチェック。`..` や絶対パスを含むエントリは拒否（パストラバーサル防止）。

### フィルタリング

インポート時に `_filterValidItems()` で無効なエントリを除外:
- `targetUrl` が空のもの
- ファイルが存在しないもの（ローカルソースの場合）

## Tauri側（`apps/tauri/src/infrastructure/local-api/services/source-backup-service.ts`）

Tauriアプリ内でも同等のバックアップ機能を提供。Rustコマンド（`src-tauri/src/commands/backup.rs`）と連携。

## UIフロー

```
ImportReviewModal
    ↓
listPendingImports()   ← インポートキューの一覧を表示
    ↓ ユーザーが選択・確認
processPendingImports()  ← 選択されたアイテムを処理
    ↓
cancelPendingImports()   ← 不要なアイテムを破棄
```

## CLI経由のDB操作（別機能）

`imager-cli db` コマンドは PostgreSQL の `pg_dump` / `psql` を使ったDBレベルのダンプ/リストア（上記の「メディアバックアップ」とは別物）。

```bash
imager-cli db dump --output backup.sql
imager-cli db restore --input backup.sql
imager-cli db dump --docker   # Dockerコンテナ内のpostgresを対象
```
