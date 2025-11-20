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

### メディア (Media)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/sources/{mediaSourceId}/search` | 特定メディアソース内のメディアを検索します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}` | 特定のメディアファイル本体を取得します。 |
| `PUT` | `/api/sources/{mediaSourceId}/{mediaId}` | 特定のメディア情報を更新します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/details` | タグやメタデータを含むメディアの詳細情報を取得します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/metadata` | メディアの生成メタデータを取得します。 |
| `POST` | `/api/sources/{mediaSourceId}/upload` | メディアファイルをアップロードします。 |

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


### ディレクトリ (Directories)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/sources/{mediaSourceId}/directories` | 指定パス以下のディレクトリとメディア一覧を取得します。 |
| `POST` | `/api/sources/{mediaSourceId}/directories/create` | 新しいディレクトリを作成します。 |
| `DELETE` | `/api/sources/{mediaSourceId}/directories/delete` | ディレクトリを削除します。 |
| `PUT` | `/api/sources/{mediaSourceId}/directories/rename` | ディレクトリ名を変更します。 |
| `GET` | `/api/sources/{mediaSourceId}/directories/{...directories}` | 特定ディレクトリ内のメディアとサブディレクトリを取得します。 |
| `GET` | `/api/sources/{mediaSourceId}/directories/{...directories}/search` | 特定ディレクトリ内でメディアを検索します。 |

### タグ (Tags)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/tags` | 全てのタグを取得します。 |
| `POST` | `/api/tags` | 新しいタグを作成します。 |
| `GET` | `/api/tags/{id}` | 特定のタグを取得します。 |
| `PUT` | `/api/tags/{id}` | 特定のタグを更新します。 |
| `DELETE` | `/api/tags/{id}` | 特定のタグを削除します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/tags` | 特定メディアに関連付けられたタグを取得します。 |

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
| `PUT` | `/api/charactors/{id}` | 特定のキャラクターを更新します。 |
| `DELETE` | `/api/charactors/{id}` | 特定のキャラクターを削除します。 |
| `GET` | `/api/sources/{mediaSourceId}/{mediaId}/charactors` | 特定メディアに関連付けられたキャラクターを取得します。 |

### IP (Intellectual Properties)

| Method | Path | 説明 |
|---|---|---|
| `GET` | `/api/ips` | 全てのIPを取得します。 |
| `POST` | `/api/ips` | 新しいIPを作成します。 |
| `GET` | `/api/ips/{id}` | 特定のIPを取得します。 |
| `PUT` | `/api/ips/{id}` | 特定のIPを更新します。 |
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
| `GET` | `/api/sources/{mediaSourceId}/events` | SSEでメディアソースのリアルタイム更新を監視します。 |
| `GET` | `/api/sources/{mediaSourceId}/events/thumbnail-progress` | SSEでサムネイル生成の進捗を監視します。 |

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
