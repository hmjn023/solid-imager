# apps/tauri

`@solid-imager/tauri` — デスクトップアプリケーション。TauriフレームワークでSolidJSフロントエンドとRustバックエンドを統合。**Docker不要のスタンドアロン動作**を実現。

## 特徴

- **PGlite**（WasmベースのPostgreSQL互換DB）を内蔵 → Dockerなしで動作
- Rustネイティブコマンドで高速なファイルシステム操作・ウォッチャー
- DBマイグレーションは `apps/server/drizzle/` のファイルを共有利用
- `apps/server` とUIのparity（機能同期）を維持

## ソース構成

```
apps/tauri/
├── src/                          # SolidJSフロントエンド
│   ├── bootstrap.ts              # アプリ初期化
│   ├── router.tsx                # TanStack Router設定
│   ├── routes/                   # ページルート
│   │   ├── index.tsx             # ホーム
│   │   ├── sources/              # メディアソース・詳細
│   │   ├── search.tsx            # 検索
│   │   ├── manager.tsx           # メディア管理
│   │   └── config.tsx            # 設定
│   ├── components/               # UIコンポーネント
│   ├── hooks/                    # カスタムフック
│   ├── infrastructure/
│   │   ├── api/                  # APIクライアント（サーバー連携用）
│   │   ├── local-api/            # スタンドアロンAPI実装
│   │   │   ├── repositories/     # PGliteリポジトリ実装（10個）
│   │   │   └── services/         # ローカルサービス
│   │   ├── db/                   # PGliteクライアント・マイグレーション
│   │   ├── jobs/                 # ジョブキュー（サムネイル）
│   │   ├── media/                # メディア処理
│   │   ├── path-utils.ts         # Tauriパスユーティリティ
│   │   └── tauri/                # Tauriブリッジ（コマンド・FS・画像処理）
│   └── mocks/                    # テスト用モック
└── src-tauri/                    # Rustバックエンド
    └── src/
        ├── main.rs               # Tauriエントリポイント
        ├── watcher.rs            # ファイルシステムウォッチャー
        ├── media_metadata.rs     # メディアメタデータ読み取り
        ├── media_config.rs       # メディア設定
        └── commands/
            ├── fs.rs             # ファイルシステムコマンド
            ├── media.rs          # メディア操作コマンド
            ├── backup.rs         # バックアップコマンド
            └── utils.rs          # ユーティリティ
```

## データベース（PGlite）

- `apps/server/drizzle/*.sql` のマイグレーションを動的importで共有
- `infrastructure/db/client.ts` でPGliteインスタンスを初期化
- スキーマはサーバーと共通（`infrastructure/db/schema.ts` で再エクスポート）

## ローカルリポジトリ（`local-api/repositories/`）

PGlite上に実装されたリポジトリ：
`media` / `source` / `tag` / `character` / `ip` / `author` / `preset` / `project` / `app-config` / `tauri-job`

すべて `packages/core` のリポジトリインターフェースを実装。

## Rustコマンド（`src-tauri/src/commands/`）

| モジュール | 主な機能 |
|---|---|
| `fs` | ディレクトリ一覧・ファイル操作 |
| `media` | メタデータ読み取り・サムネイル生成 |
| `backup` | DBバックアップ・リストア |
| `utils` | システム情報取得 |

## ファイル監視（`watcher.rs`）

ネイティブのファイルシステムウォッチャー。ディレクトリの変更を検知してフロントエンドへイベント通知。

## ジョブキュー（`infrastructure/jobs/`）

| ファイル | 機能 |
|---|---|
| `tauri-job-queue.ts` | Tauriアプリ内ジョブキュー管理 |
| `thumbnail-job.ts` | サムネイル生成バックグラウンドジョブ |

## parity ルールとの関係

`apps/server` との機能同期対象：
- ソース管理・メディア一覧・検索・詳細・マネージャー・設定

parity除外（当面）：
- リモートソース（SFTP / S3）— ローカルのみ対応
- AI standalone実装 — サーバー委譲が正

## 開発・ビルド

```bash
# 開発
bun --filter @solid-imager/tauri run tauri dev

# ビルド
bun --filter @solid-imager/tauri run tauri build
```

Rust toolchain（`cargo`）が必要。
