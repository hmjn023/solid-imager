# apps/cli

`@solid-imager/cli` — solid-imagerサーバーをリモートで操作するCLIツール。Bunで単一バイナリにコンパイルして配布できる。

## 概要

- **フレームワーク**: [incur](https://github.com/trkbt10/incur)（Zod統合CLIフレームワーク）
- **通信**: oRPC クライアント経由でサーバーAPIを呼び出す
- **バイナリ**: `bun compile` でシングルバイナリ生成

## コマンド一覧

### `imager-cli ping`

サーバーへの疎通確認。接続先URLと現在の設定を返す。

```bash
imager-cli ping --remote http://localhost:3000
```

### `imager-cli media`

| サブコマンド          | 説明                                              |
| --------------------- | ------------------------------------------------- |
| `media list`          | メディア一覧取得（フィルタ/ページネーション対応） |
| `media get <id>`      | 指定メディアの詳細取得                            |
| `media download <id>` | ファイルをローカルへダウンロード                  |
| `media update <id>`   | メタデータ更新                                    |
| `media delete <id>`   | メディア削除                                      |

ダウンロード時はパストラバーサル防止チェックあり。エージェント（MCP）経由の場合はCWD内のみ許可。

### `imager-cli ai`

| サブコマンド       | 説明                                   |
| ------------------ | -------------------------------------- |
| `ai tag <mediaId>` | 指定メディアにAI自動タグ付けを実行     |
| `ai status`        | AIサービス（Python FastAPI）の疎通確認 |

### `imager-cli job`

バックグラウンドジョブ管理（`list` / `retry` / `clear`）。  
※ 現時点ではサーバー側のoRPCジョブルーターが未公開のため `NOT_IMPLEMENTED` を返す。

### `imager-cli db`

| サブコマンド | 説明                            |
| ------------ | ------------------------------- |
| `db dump`    | pg_dump でDBをダンプ            |
| `db restore` | psql でダンプファイルをリストア |

Docker経由（`--docker`フラグ）でコンテナ内のpostgresに直接アクセスも可能。

## グローバルオプション

| オプション | デフォルト              | 説明        |
| ---------- | ----------------------- | ----------- |
| `--remote` | `http://localhost:3000` | サーバーURL |

## ビルド

```bash
bun --filter @solid-imager/cli run build
# → dist/imager-cli (シングルバイナリ)
```

## ソース構成

```
apps/cli/src/
├── index.ts           # エントリポイント・コマンド登録
├── orpc-client.ts     # oRPCクライアント初期化
├── utils.ts           # グローバルオプション・エラーユーティリティ
└── commands/
    ├── media.ts       # media コマンド群
    ├── job.ts         # job コマンド群
    ├── ai.ts          # ai コマンド群
    └── db.ts          # db コマンド群
```
