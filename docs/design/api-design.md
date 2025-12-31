# 05 API設計

## 概要

このドキュメントは、Solid ImagerアプリケーションのAPIのハイレベルな概要を提供します。

**API仕様の信頼できる唯一の情報源（Single Source of Truth）は、ソースコードのJSDocコメントから自動生成されるOpenAPI仕様です。** 詳細なリクエスト/レスポンススキーマやパラメータについては、アプリケーション実行中にアクセスできるSwagger UIを参照してください。

-   **Swagger UI:** [`/docs/swagger`](http://localhost:3000/docs/swagger)

このドキュメントの目的は、API全体の構造と設計思想を理解しやすくすることです。APIドキュメントの自動生成プロセスについては、[09-api-documentation.md](./09-api-documentation.md) を参照してください。

## 共通原則

-   RESTful設計原則に準拠します。
-   エンドポイントの命名規則に一貫性を持たせます。
-   HTTPメソッド（`GET`, `POST`, `PUT`, `DELETE`）を適切に使い分けます。
-   エラーハンドリングを統一します。
-   パス内のパラメータは `{param}` 形式で表現されます（例: `/api/categories/{id}`）。
-   SolidStartのファイルベースルーティングを利用しており、`[param]` や `[...param]` といったディレクトリ・ファイル名がAPIパスに対応します。

## セキュリティ (Security)

API設計においては、以下のセキュリティ対策を講じています。

### Safe DTO (Data Transfer Objects)

-   データベースに保存されている機密情報（パスワード、秘密鍵、APIキーなど）は、APIレスポンスに含まれてはいけません。
-   必ず `SafeMediaSource` のような、機密情報を除外したDTO（Data Transfer Object）を使用してください。
-   OpenAPIスキーマ定義においても、機密情報が含まれないスキーマを参照するようにしてください。

## エンドポイント一覧

以下に、現在実装されている主要なAPIエンドポイントをリソースごとに示します。

### メディアソース (Media Sources)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/sources` | 全てのメディアソースを取得します。 |
| `POST` | `/api/sources` | 新しいメディアソースを作成します。 |
| `GET` | `/api/sources/{mediaSourceId}` | 特定のメディアソース内の全メディアを取得します。 |
| `PUT` | `/api/sources/{mediaSourceId}` | 特定のメディアソースを更新します。 |
| `DELETE` | `/api/sources/{mediaSourceId}` | 特定のメディアソースを削除します。 |
| `GET` | `/api/sources/{mediaSourceId}/status` | 特定のメディアソースの状態を取得します。 |
| `POST` | `/api/sources/{mediaSourceId}/restore` | JSONダンプからメディアのメタデータを復元します。 |

### メディア (Media)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/sources/{mediaSourceId}/search` | 特定メディアソース内のメディアを検索します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}` | 特定のメディアファイル本体を取得します。 |
| `PUT` | `/api/sources/{mediaSourceId}/{mediaId}` | 特定のメディア情報を更新します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/details` | タグやメタデータを含むメディアの詳細情報を取得します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/metadata` | メディアの生成メタデータを取得します。 |
| `POST` | `/api/sources/{mediaSourceId}/upload` | メディアファイルをアップロードします。 |
| `POST` | `/api/sources/{mediaSourceId}/upload` | メディアファイルをアップロードします。 |
| `POST` | `/api/sources/{mediaSourceId}/{mediaId}/copy` | メディアを指定されたソースにコピーします。 |
| `POST` | `/api/sources/{mediaSourceId}/{mediaId}/move` | メディアを指定されたソースに移動します（元のファイルは削除されます）。 |

#### 検索クエリパラメータ (Search Query Parameters)

`/api/sources/{mediaSourceId}/search` および `/api/sources/{mediaSourceId}/directories/{...directories}/search` エンドポイントは以下のクエリパラメータをサポートします。

| パラメータ | 型 | 説明 | 例 |
|---|---|---|---|
| `q` | `string` | ファイル名検索（部分一致） | `miku` |
| `tags` | `string` | タグ検索。カンマ区切りで複数指定可能。 | `tag1,tag2` |
| `tagMode` | `string` | タグ検索モード。`and` (すべて含む) または `or` (いずれかを含む)。デフォルトは `and`。 | `or` |
| `excludeTags` | `string` | 除外タグ検索。カンマ区切りで複数指定可能。 | `nsfw,low_quality` |
| `sort` | `string` | ソート順。`date` (作成日), `name` (ファイル名), `size` (サイズ) など。 | `date` |
| `order` | `string` | 昇順・降順。`asc` または `desc`。 | `desc` |
| `limit` | `integer` | 取得件数。デフォルトは無制限（全件取得）。パフォーマンスに注意。 | `50` |
| `offset` | `integer` | ページネーション用オフセット。 | `0` |
| `projects` | `string` | プロジェクトIDフィルタ。カンマ区切りで複数指定可能。 | `1,2` |
| `ips` | `string` | IP IDフィルタ。カンマ区切りで複数指定可能。 | `1,2` |
| `characters` | `string` | キャラクターIDフィルタ。カンマ区切りで複数指定可能。 | `1,2` |


### ディレクトリ (Directories)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/sources/{mediaSourceId}/directories` | 指定パス以下のディレクトリとメディア一覧を取得します。 |
| `POST` | `/api/sources/{mediaSourceId}/directories/create` | 新しいディレクトリを作成します。 |
| `DELETE` | `/api/sources/{mediaSourceId}/directories/delete` | ディレクトリを削除します。 |
| `PUT` | `/api/sources/{mediaSourceId}/directories/rename` | ディレクトリ名を変更します。 |
| `GET` | `/api/sources/{mediaSourceId}/directories/{...directories}` | 特定ディレクトリ内のメディアとサブディレクトリを取得します。 |
| `GET` | `/api/sources/{mediaSourceId}/directories/{...directories}/search` | 特定ディレクトリ内でメディアを検索します。 |

### プロジェクト (Projects)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/projects` | 全てのプロジェクトを取得します。 |
| `POST` | `/api/projects` | 新しいプロジェクトを作成します。 |
| `GET` | `/api/projects/{id}` | 特定のプロジェクトを取得します。 |
| `PATCH` | `/api/projects/{id}` | 特定のプロジェクトを更新します。 |
| `DELETE` | `/api/projects/{id}` | 特定のプロジェクトを削除します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/projects` | 特定メディアに関連付けられたプロジェクトを取得します。 |
| `POST` | `/api/sources/{mediaSourceId}/{mediaId}/projects` | 特定メディアにプロジェクトを追加します。 |
| `DELETE` | `/api/sources/{mediaSourceId}/{mediaId}/projects/{projectId}` | 特定メディアからプロジェクトを削除します。 |

### タグ (Tags)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/tags` | 全てのタグを取得します。 |
| `POST` | `/api/tags` | 新しいタグを作成します。 |
| `GET` | `/api/tags/{id}` | 特定のタグを取得します。 |
| `PUT` | `/api/tags/{id}` | 特定のタグを更新します。 |
| `DELETE` | `/api/tags/{id}` | 特定のタグを削除します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/tags` | 特定メディアに関連付けられたタグを取得します。 |
| `POST` | `/api/sources/{mediaSourceId}/{mediaId}/tags` | 特定メディアにタグを追加します。 |
| `DELETE` | `/api/sources/{mediaSourceId}/{mediaId}/tags/{tagId}` | 特定メディアからタグを削除します。 |

### カテゴリ (Categories)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/categories` | 全てのカテゴリを取得します。 |
| `POST` | `/api/categories` | 新しいカテゴリを作成します。 |
| `GET` | `/api/categories/{id}` | 特定のカテゴリを取得します。 |
| `PUT` | `/api/categories/{id}` | 特定のカテゴリを更新します。 |
| `DELETE` | `/api/categories/{id}` | 特定のカテゴリを削除します。 |

### キャラクター (Characters)

**注意:** パス名が `charactors` となっていますが、これは `characters` のタイポの可能性があります。

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/charactors` | 全てのキャラクターを取得します。 |
| `POST` | `/api/charactors` | 新しいキャラクターを作成します。 |
| `GET` | `/api/charactors/{id}` | 特定のキャラクターを取得します。 |
| `PATCH` | `/api/charactors/{id}` | 特定のキャラクターを更新します。 |
| `DELETE` | `/api/charactors/{id}` | 特定のキャラクターを削除します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/charactors` | 特定メディアに関連付けられたキャラクターを取得します。 |

### IP (Intellectual Properties)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/ips` | 全てのIPを取得します。 |
| `POST` | `/api/ips` | 新しいIPを作成します。 |
| `GET` | `/api/ips/{id}` | 特定のIPを取得します。 |
| `PATCH` | `/api/ips/{id}` | 特定のIPを更新します。 |
| `DELETE` | `/api/ips/{id}` | 特定のIPを削除します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/ips` | 特定メディアに関連付けられたIPを取得します。 |

### サムネイル (Thumbnails)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/thumbnail` | 特定メディアのサムネイルを取得します。 |
| `POST` | `/api/sources/{mediaSourceId}/thumbnails` | サムネイルの手動生成を開始します。 |
| `DELETE` | `/api/sources/{mediaSourceId}/thumbnails` | サムネイルキャッシュをクリアします。 |

### リアルタイム更新 (Real-time Updates)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/sse/{mediaSourceId}` | SSEでメディアソースのリアルタイム更新を監視します。 |

#### SSE イベントタイプ

`/api/sse/{mediaSourceId}` エンドポイントは以下のイベントタイプを送信します:

- `thumbnail-generated`: サムネイル生成完了時に送信
  - データ: `{ mediaId: string }`
  - フロントエンドはこのイベントを受信してメディアリストを再取得
- `media-added`: ファイルシステムに新しいメディアファイルが追加された時に送信
  - データ: `{ filePath: string, timestamp: string }`
  - ファイル追加を検知し、メディア登録とサムネイル生成をキューに追加
- `media-deleted`: ファイルシステムからメディアファイルが削除された時に送信
  - データ: `{ filePath: string, timestamp: string }`
  - フロントエンドは即座にメディアリストを再取得してUIから削除
- `media-changed`: ファイルシステムのメディアファイルが変更された時に送信
  - データ: `{ filePath: string, timestamp: string }`
  - メタデータ更新とサムネイル再生成をキューに追加
- `watcher-error`: ファイルシステム監視でエラーが発生した時に送信
  - データ: `{ error: string, timestamp: string }`

#### ファイルシステム監視

ローカルメディアソース (`type: 'local'`) に対して、`chokidar`を使用してファイルシステムを監視します:

- **監視対象**: 画像ファイル (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`)
- **監視範囲**: サブディレクトリも再帰的に監視
- **自動処理**:
  - ファイル追加時: メディアをDBに登録し、サムネイル生成をキューに追加
  - ファイル削除時: DBとサムネイルキャッシュから削除
  - ファイル変更時: メタデータを更新し、サムネイルを再生成
- **自動監視開始**:
  - アプリケーション起動時に既存のローカルメディアソースの監視を自動開始
  - メディアソース作成時に監視を自動開始
  - メディアソース削除時に監視を自動停止

**使用例 (フロントエンド)**:
```typescript
const eventSource = new EventSource(`/api/sse/${mediaSourceId}`);

// サムネイル生成完了時にメディアリストを再取得
eventSource.addEventListener('thumbnail-generated', (event) => {
  const data = JSON.parse(event.data);
  console.log('Thumbnail ready for media:', data.mediaId);
  refetch();
});

// ファイル削除時にメディアリストを再取得
eventSource.addEventListener('media-deleted', (event) => {
  const data = JSON.parse(event.data);
  console.log('Media deleted:', data.filePath);
  refetch();
});

// クリーンアップ
onCleanup(() => eventSource.close());
```

**注意**: `media-added`と`media-changed`イベントでは即座にrefetchせず、`thumbnail-generated`イベントが来た時にrefetchすることで、サムネイルが表示された状態でUIが更新されます。

### 設定 (Configuration)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/config` | アプリケーション設定を取得します。 |
| `PUT` | `/api/config` | アプリケーション設定を更新します。 |
| `POST` | `/api/config` | アプリケーション設定をリセットします。 |

### ユーティリティ (Utilities)

| Method | Path | 説明 |
|---|---|---|
| `POST` | `/api/fetch-url` | 指定されたURLからコンテンツを取得します。 |

### ダウンロード (Downloads)

| Method | Path | 説明 |
|---|---|---|
| `POST` | `/api/downloads` | JSONファイルから複数の画像を一括ダウンロードして登録します。 |

### AI (Artificial Intelligence)

| Method | Path | 説明 |
|---|---|---|
| `POST` | `/api/ai/tag` | 画像のタグ付けを行います（一般タグ、キャラクター、IP）。ファイルアップロードまたはメディアID指定に対応。 |
| `POST` | `/api/ai/ccip/feature` | 画像からCCIP特徴量を抽出します。ファイルアップロードまたはメディアID指定に対応。 |
| `POST` | `/api/ai/ccip/difference` | 2つのCCIP特徴量間の差分を計算します。 |

**`POST /api/downloads`**

JSONファイルに記載された画像URLから画像を一括ダウンロードし、メディアとして登録します。各画像のメタデータ（ツイート情報、タイムスタンプ、作者情報など）はMarkdown形式でdescriptionフィールドに保存されます。

**リクエストボディ**:
```json
{
  "mediaSourceId": "uuid-here",
  "items": [
    {
      "imageUrl": "https://example.com/image.jpg",
      "tweetUrl": "https://x.com/user/status/123",
      "tweetText": "Sample tweet text",
      "timestamp": "2025-11-24T04:05:10.000Z",
      "authorName": "Author Name",
      "authorId": "@author"
    }
  ]
}
```

**レスポンス**:
```json
{
  "success": true,
  "jobCount": 1,
  "message": "Queued 1 download jobs"
}
```

**処理フロー**:
1. JSONファイルをパースして各画像のダウンロードジョブを作成
2. 各画像をURLからダウンロードしてメディアソースに保存
3. メタデータをMarkdown形式でdescriptionに記録
4. サムネイル生成ジョブをキューに追加
5. SSEイベント(`media-added`, `thumbnail-generated`)を通じてフロントエンドに通知

