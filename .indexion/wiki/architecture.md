# Architecture

## レイヤー構成（Clean Architecture）

```
┌─────────────────────────────────────┐
│  Presentation (Routes / UI)          │  ← SolidJS routes, components
├─────────────────────────────────────┤
│  Application (Services / Use Cases)  │  ← Business logic orchestration
├─────────────────────────────────────┤
│  Infrastructure (DB / API / Storage) │  ← Drizzle ORM, file system, jobs
├─────────────────────────────────────┤
│  Core / Domain (packages/core)       │  ← Entities, schemas, interfaces
└─────────────────────────────────────┘
```

**依存方向**: `Infrastructure` → `Application` → `Core`。Coreは他レイヤーに依存しない。

## モノレポ構成

```
solid-imager/
├── apps/
│   ├── server/          # Webアプリ（TanStack Start + oRPC）
│   │   ├── src/application/     # アプリケーションサービス
│   │   ├── src/infrastructure/  # DB、ストレージ、AI連携、ジョブ
│   │   ├── src/presentation/    # グローバルストア
│   │   ├── src/routes/          # ページルート
│   │   └── src/components/      # UIコンポーネント
│   ├── tauri/           # デスクトップアプリ（Tauri v2）
│   │   ├── src/                 # SolidJSフロントエンド
│   │   └── src-tauri/           # Rustバックエンド
│   ├── cli/             # CLIツール
│   └── xtracter/         # ブラウザ拡張機能
├── packages/
│   ├── core/            # 共有ドメインモデル
│   └── ui/              # 共有UIコンポーネント
└── src-python/          # AI解析サービス（FastAPI）
```

## データフロー

```
Browser/Desktop
    ↓ HTTP / oRPC / Tauri IPC
API Layer (oRPC handlers)
    ↓
Application Services
    ↓
Repository Interfaces (packages/core)
    ↓ implemented by
Infrastructure Repositories (Drizzle ORM)
    ↓
PostgreSQL / PGlite
```

## server / tauri 機能同期ルール

`apps/server`と`apps/tauri`は同一責務の機能を可能な限り揃えて実装する（parity）。

**同期対象**: `sources` / `search` / `detail` / `manager` / `config` など主機能

**parity除外（当面）**:

- Tauriの `index` / `about` などシェルページ差分
- TauriのリモートソースSFTP / S3
- Tauri standalone AI実装（AI は server 委譲が正）

## APIレイヤー（oRPC）

- スキーマ駆動開発：全APIはZodスキーマで型定義
- **Safe DTO**: APIレスポンスは必ずSafe DTOを経由し機密情報を除外
- エンドポイントは `apps/server/src/routes/api/` に定義

## データベース

| 環境                  | DB                         |
| --------------------- | -------------------------- |
| サーバー（本番/開発） | PostgreSQL（Docker）       |
| Tauriデスクトップ     | PGlite（Wasm、Dockerなし） |

- 全テーブルUUID (v4)
- 中間テーブルは `media_{entity}` 命名規則
- マイグレーション: Drizzle ORM

## ジョブキュー

バックグラウンド処理（サムネイル生成、AI解析など）はジョブキューで管理。  
`apps/server/src/infrastructure/jobs/` に実装。

## ストレージバックエンド

`apps/server/src/infrastructure/storage/` に抽象化：

- `local.ts`: ローカルファイルシステム
- `sftp.ts`: SFTPサーバー
- `s3.ts`: Amazon S3
