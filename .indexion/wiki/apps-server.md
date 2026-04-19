# apps/server

`@solid-imager/server` — メインWebアプリケーション。TanStack Start + oRPC でバックエンドAPIとフロントエンドUIを一体で提供する。

## 技術スタック

| 項目 | 技術 |
|---|---|
| フレームワーク | TanStack Start（SolidJS） |
| ルーティング | TanStack Router（ファイルベース） |
| サーバー | Nitro |
| RPC | oRPC（`@orpc/server/fetch`） |
| DB | Drizzle ORM + PostgreSQL |
| UI | Kobalte + Tailwind CSS |

## ソース構成

```
apps/server/src/
├── application/
│   ├── registry.ts          # DIコンテナ（サービス登録）
│   ├── services/            # アプリケーションサービス（27個）
│   └── utils/
├── infrastructure/
│   ├── api/
│   │   ├── routers/         # oRPCルーター（16個）
│   │   └── clients/         # 外部APIクライアント
│   ├── db/                  # Drizzle設定・スキーマ・接続
│   ├── repositories/        # リポジトリ実装（Drizzle ORM）
│   ├── storage/             # ストレージバックエンド（local/sftp/s3）
│   ├── jobs/                # ジョブキュー・ワーカー
│   └── utils/               # FFmpeg等ユーティリティ
├── presentation/
│   └── store/               # グローバルSolidストア
├── routes/                  # TanStack Routerページ + APIルート
│   ├── api/                 # RESTエンドポイント（TanStack server handlers）
│   └── sources/             # ソース・メディア詳細ページ
├── components/              # ページ固有コンポーネント
├── hooks/                   # SolidJSカスタムフック
└── domain/
    └── shared/              # appRouter定義（oRPC集約）
```

## アプリケーションサービス一覧

| サービス | 責務 |
|---|---|
| `MediaService` | メディアCRUD・検索 |
| `MediaProcessingService` | メディア処理ジョブ制御 |
| `ThumbnailService` | サムネイル生成管理 |
| `TaggingService` | AIタグ付け実行 |
| `TagService` | タグCRUD |
| `CharacterService` | キャラクターCRUD |
| `IpService` | IP管理 |
| `AuthorService` | 作者管理 |
| `SearchService` | 全文・タグ検索 |
| `DirectorySyncService` | ディレクトリ監視・同期 |
| `BackupService` | バックアップ・リストア |
| `EventService` | SSEイベント配信 |
| `JobDispatchService` | ジョブキュー投入 |
| `MaintenanceService` | DB保守・クリーンアップ |
| `ServerConfigService` | サーバー設定管理 |
| `UserService` | ユーザー管理 |
| `WorkflowService` | 複合ワークフロー |

## oRPC ルーター一覧

`apps/server/src/infrastructure/api/routers/` に定義：

`media` / `sources` / `tags` / `characters` / `ips` / `authors` / `categories` / `projects` / `collections` / `presets` / `directories` / `downloads` / `imports` / `thumbnails` / `ai` / `config` / `utils`

## APIエンドポイント（REST）

`apps/server/src/routes/api/` — TanStack Router の `server.handlers` で実装：

| ルート | 説明 |
|---|---|
| `POST /api/rpc/$` | oRPC汎用ハンドラー |
| `GET /api/events` | SSEストリーム |
| `GET /api/sources/:id/:mediaId` | メディアファイル配信 |
| `GET /api/sources/:id/:mediaId/thumbnail` | サムネイル配信 |
| `GET /api/sources/:id/dump` | ソースデータダンプ |
| `POST /api/sources/:id/import` | ソースデータインポート |

## ジョブキュー

`apps/server/src/infrastructure/jobs/` に実装：

| ファイル | 機能 |
|---|---|
| `job-queue.ts` | インメモリジョブキュー |
| `job-worker.ts` | ワーカー（並行実行制御） |
| `thumbnails.ts` | サムネイル生成ジョブ |
| `tagging-jobs.ts` | AIタグ付けジョブ |
| `download-jobs.ts` | ダウンロードジョブ |
| `download-rate-limiter.ts` | ダウンロードレート制限 |
| `file-watcher-service.ts` | ファイルシステム監視 |
| `sse-manager.ts` | SSEコネクション管理 |

## DBマイグレーション

```bash
bun --filter @solid-imager/server run db:generate  # マイグレーションファイル生成
bun --filter @solid-imager/server run db:migrate   # マイグレーション適用
```

マイグレーションファイルは `apps/server/drizzle/` に格納（現在0012番まで）。

## テスト構成

| テスト種別 | 設定ファイル | 対象 |
|---|---|---|
| ユニット | `vitest.unit.config.ts` | サービス・ロジック単体 |
| 統合 | `vitest.integration.config.ts` | DB・リポジトリ |
| E2E | Playwright | ページ動作確認 |
