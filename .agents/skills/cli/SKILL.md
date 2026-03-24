---
name: cli
description: imager-cli のコマンド開発・変更時。CLIコマンドの追加・修正時はこのスキルを参照してください。
---

# CLI スキル

## 概要

`imager-cli` は Solid Imager インスタンスを管理するCLI。[incur](https://github.com/solid-imager/incur) ライブラリで構築、oRPC でサーバー通信。

## 実行

```bash
bun run --filter @solid-imager/cli dev --help
```

ビルド:
```bash
cd apps/cli && bun run build
# apps/cli/dist/imager-cli にバイナリ生成
```

## グローバルオプション

- `--remote <url>`: サーバーURL (デフォルト: `http://localhost:3000`)
- `--source <uuid>`: メディアソース ID

## コマンド一覧

### `ping`
サーバー接続確認。`imager-cli ping [--remote <url>]`

### `media`
- `media get <id>` — メタデータ取得 (`--source` 必須)
- `media search` — 検索 (`--query`, `--limit`, `--offset`)
- `media view <id>` — ターミナルで画像表示 (`--width`, `--height`)
- `media download <id>` — ダウンロード (`--output`)

### `ai`
- `ai tag <mediaId>` — AIタグ付け (`--mediaSourceId` 必須)
- `ai status` — AIサービス稼働確認

### `db`
- `db dump` — DBダンプ (`--format sql|json|zip`, `--output`, `--docker`)
- `db restore <filepath>` — DB復元 (`--docker`)

### `job`
- `job list` — ジョブ一覧 (`--status`, `--type`, `--limit`)
- `job retry <id>` — 失敗ジョブ再試行
- `job clear` — ジョブ履歴削除 (`--status completed|failed`)

## 開発時の注意

- コマンドは `apps/cli/src/commands/` に定義
- サーバーAPIが未実装の場合 `NOT_IMPLEMENTED` を返すことがある
