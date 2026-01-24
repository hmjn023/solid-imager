# config

## 概要
システム全体の設定を単一の JSON ファイル (`config.json`) として管理可能にする。
これにより、環境変数 (`.env`) への過度な依存を減らし、実行時に UI や API を通じて設定を変更・永続化できるようにする。

## 設定ファイルの仕様
- **ファイルパス**: プロジェクトルート直下の `config.json`
- **形式**: JSON (Strict)
- **読み込みタイミング**: サーバー起動時
- **ホットリロード**: 一部の設定（ジョブ同時実行数など）は変更時に即時反映される

## 設定構造と詳細

### 1. 全体構造
```json
{
  "version": "1.0.0",
  "database": { ... },
  "jobs": { ... },
  "ai": { ... },
  "storage": { ... },
  "media": { ... },
  "logging": { ... }
}
```

### 2. 各セクションの詳細

#### 2.1 Database (`database`)
データベースへの接続設定を管理する。

| キー | 型 | 説明 |
| :--- | :--- | :--- |
| `type` | `"pglite" \| "docker-compose-postgres"` | 使用するデータベースの種類。 |
| `pglite` | `object` | `type` が `pglite` の場合の設定。 |
| `pglite.path` | `string` | データファイルの保存ディレクトリパス。 |
| `dockerComposePostgres` | `object` | `type` が `docker-compose-postgres` の場合の設定。 |
| `dockerComposePostgres.host` | `string` | DBホスト名。 |
| `dockerComposePostgres.port` | `number` | DBポート番号。 |
| `dockerComposePostgres.user` | `string` | 接続ユーザー名。 |
| `dockerComposePostgres.password` | `string` | 接続パスワード。 |
| `dockerComposePostgres.database` | `string` | データベース名。 |

#### 2.2 Job Processing (`jobs`)
サムネイル生成やメタデータ抽出などのバックグラウンド処理の挙動を制御する。

| キー | 型 | デフォルト | 説明 |
| :--- | :--- | :--- | :--- |
| `concurrency` | `number` | `3` | ジョブを同時に処理するワーカーの数。CPU負荷が高い場合は下げる。 |
| `pollIntervalMs` | `number` | `1000` | ジョブキューをポーリングする間隔（ミリ秒）。 |
| `enableAutoTagging` | `boolean` | `false` | メディア追加時に自動的に AI タグ付けを実行するかどうか。`ai` 設定が正しく構成されている必要がある。 |

#### 2.3 AI Service (`ai`)
Python で動作する AI タグ付け・解析サービスとの連携設定。

| キー | 型 | デフォルト | 説明 |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `string` | `"http://localhost:8000"` | Python AI サービスの API エンドポイント。 |
| `timeoutMs` | `number` | `30000` | AI サービスへのリクエストタイムアウト時間（ミリ秒）。モデルのロード時間は考慮が必要。 |

#### 2.4 Storage (`storage`)
生成物やキャッシュの保存先設定。

| キー | 型 | デフォルト | 説明 |
| :--- | :--- | :--- | :--- |
| `thumbnailDir` | `string` | `"./.cache/thumbnails"` | サムネイル画像の保存先ディレクトリ（プロジェクトルート相対）。 |
| `thumbnailSize` | `number` | `512` | 生成するサムネイルの長辺サイズ（ピクセル）。 |
| `thumbnailQuality` | `number` | `80` | サムネイル（WebP形式）の圧縮品質（1-100）。 |

#### 2.5 Media Configuration (`media`)
メディアファイルの取り扱いに関する詳細設定。

##### 2.5.1 Supported Extensions (`supportedExtensions`)
システムが認識・取り込みを行うファイル拡張子のリスト。これに含まれないファイルは無視される。

- `image`: 画像ファイル（例: `[".jpg", ".png", ".webp"]`）
- `video`: 動画ファイル（例: `[".mp4", ".webm"]`）
- `audio`: 音声ファイル（例: `[".mp3"]`）

##### 2.5.2 Tag Extraction (`tagExtraction`)
ComfyUI 等のワークフローメタデータ（JSON）から、プロンプト（タグ）を抽出・分類するためのルール。
ノードの種類やキーワードに基づいて、抽出されたテキストを「ポジティブタグ」か「ネガティブタグ」かに分類する。

**`comfyui` 設定オブジェクト:**

| キー | 型 | 説明 |
| :--- | :--- | :--- |
| `positiveNodeTypes` | `string[]` | **ポジティブタグ**の抽出元となるノードの `type` 名。<br>例: `["CLIPTextEncode", "CR Combine Prompt"]`<br>これらのノードに含まれるテキストは、原則としてポジティブタグとして扱われる。 |
| `negativeKeywords` | `string[]` | **ネガティブ判定（ノードタイトル）**。<br>例: `["negative"]`<br>ノードの `title` にこのキーワードが含まれる場合（大文字小文字無視）、`positiveNodeTypes` に該当するノードであっても、その内容は**ネガティブタグ**として扱われる。 |
| `negativeTags` | `string[]` | **ネガティブ判定（タグ内容）**。<br>例: `["lowres"]`<br>抽出されたテキスト自体にこの単語が含まれている場合、そのテキストブロック全体を**ネガティブタグ**として扱う。<br>（例: プロンプト内に "lowres" が混ざっている場合、そのプロンプト全体がネガティブ扱いになる） |

### 6. Logging (`logging`)
アプリケーションのログ出力設定。

| キー | 型 | デフォルト | 説明 |
| :--- | :--- | :--- | :--- |
| `level` | `string` | `"info"` | 出力するログレベル。詳細度順に `trace` > `debug` > `info` > `warn` > `error` > `fatal`。 |

## ConfigService の仕様
1. **初期化**:
    - アプリケーション起動時に `config.json` を読み込む。
    - ファイルが存在しない、またはパースエラーの場合は、ハードコードされたデフォルト値で動作し、エラーログを出力する（あるいはデフォルト値でファイルを生成する）。
2. **バリデーション**:
    - 読み込み時に JSON Schema (zod等) を用いて値を検証する。不正な値がある場合はデフォルト値にフォールバックするか、起動を停止する。
3. **動的更新**:
    - 設定変更用 API (`updateConfig`) を提供する。
    - 更新時は `config.json` をアトミックに書き換える。
    - `jobs.concurrency` などの一部のパラメータは、再起動なしで `JobWorker` に新しい値を通知して反映させる。
