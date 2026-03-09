# imager-cli 利用ガイド

`imager-cli` は、Solid Imager インスタンスを管理するためのコマンドラインインターフェースです。[incur](https://github.com/solid-imager/incur) ライブラリを使用して構築されており、oRPC を介してサーバーと通信します。

## インストールとセットアップ

CLI はモノレポの一部であり、`bun` を使用して実行できます。

```bash
# プロジェクトルートから実行
bun run --filter @solid-imager/cli dev --help
```

便宜上、スタンドアロンの実行ファイルとしてビルドすることも可能です。

```bash
cd apps/cli
bun run build
# apps/cli/dist/imager-cli にバイナリが生成されます
```

## グローバルオプション

以下のオプションはすべてのコマンドで使用可能です。

- `--remote <url>`: リモートサーバーの URL (デフォルト: `http://localhost:3000`)
- `--source <uuid>`: 操作対象のメディアソース ID (UUID)。`media` コマンドの多くで推奨/必須です。

## コマンドリファレンス

### `ping`

リモートサーバーへの接続を確認し、設定情報を取得します。

**使用法:**
```bash
imager-cli ping [--remote <url>]
```

---

### `media`

メディアアイテムに関する操作。

#### `media get <id>`
ID 指定でメディアのメタデータを取得します。
- `--source <uuid>`: ソース ID (必須)
```bash
imager-cli media get <id> --source <source-uuid>
```

#### `media search`
フィルタを指定してメディアを検索します。
- `--source <uuid>`: 指定したソース内のみを検索 (オプション)
- `--query <text>`: 全文検索クエリ文字列 (オプション)
- `--limit <number>`: 最大取得件数 (デフォルト: 20)
- `--offset <number>`: ページネーションのオフセット (デフォルト: 0)
```bash
imager-cli media search --query "landscape" --limit 10
```

#### `media view <id>`
ターミナル上で画像を直接表示します。
> [!NOTE]
> iTerm2 の inline image protocol をサポートするターミナル（iTerm2, Kitty, WezTerm など）が必要です。
- `--source <uuid>`: ソース ID (必須)
- `--width <dimension>`: 幅 (例: 50%, 400px, auto)
- `--height <dimension>`: 高さ (例: auto, 400px)
```bash
imager-cli media view <id> --source <source-uuid> --width 50%
```

#### `media download <id>`
ID 指定でメディアファイルをダウンロードします。
- `--source <uuid>`: ソース ID (必須)
- `--output <path>`: 出力先のパス (オプション、デフォルトは元のファイル名)
```bash
imager-cli media download <id> --source <source-uuid> --output ./my-image.jpg
```

---

### `ai`

AI 処理ツール。

#### `ai tag <mediaId>`
特定のメディアファイルに対して AI タグ付けを実行します。
- `--mediaSourceId <uuid>`: メディアのソース ID (必須)
```bash
imager-cli ai tag <mediaId> --mediaSourceId <source-uuid>
```

#### `ai status`
AI サービスの稼働状況を確認します。
```bash
imager-cli ai status
```

---

### `db`

データベース操作 (ローカルアクセスまたは Docker が必要)。

#### `db dump`
ローカルデータベースを SQL ファイルにダンプします。
- `--format <sql|json|zip>`: ダンプ形式 (デフォルト: sql)
- `--output <path>`: 出力ファイルパス (デフォルト: `./dump.sql`)
- `--docker <boolean>`: 実行中のコンテナから docker exec を使用してダンプするかどうか (デフォルト: true)
```bash
imager-cli db dump --output ./backup.sql
```

#### `db restore <filepath>`
ファイルからローカルデータベースを復元します。
- `--docker <boolean>`: 実行中のコンテナに対して docker exec を使用して復元するかどうか (デフォルト: true)
```bash
imager-cli db restore ./backup.sql
```

---

### `job`

バックグラウンドジョブ管理。
> [!WARNING]
> これらのコマンドは CLI で定義されていますが、サーバー側の API が oRPC で公開されていない場合、`NOT_IMPLEMENTED` を返す可能性があります。

#### `job list`
実行中または最近のジョブを一覧表示します。
- `--limit <number>`
- `--offset <number>`
- `--status <pending|processing|completed|failed|cancelled>`
- `--type <string>`

#### `job retry <id>`
失敗したジョブを再試行します。

#### `job clear`
完了または失敗したジョブの履歴を削除します。
- `--status <completed|failed>`
