# 05 API設計

## 概要

このドキュメントは、Solid ImagerアプリケーションのAPIのハイレベルな概要を提供します。

**API仕様の信頼できる唯一の情報源（Single Source of Truth）は、ソースコードのZodスキーマから自動生成されるOpenAPI仕様です。** 詳細なリクエスト/レスポンススキーマやパラメータについては、アプリケーション実行中にアクセスできるSwagger UIを参照してください。

-   **Swagger UI:** [`/docs/swagger`](http://localhost:3000/docs/swagger)
-   **OpenAPI Spec:** [`/api/openapi.json`](http://localhost:3000/api/openapi.json)

このドキュメントの目的は、API全体の構造と設計思想を理解しやすくすることです。API実装の詳細については、`orpc-api` スキルを参照してください。

---

## APIアーキテクチャ

このプロジェクトでは、**2種類のAPIエンドポイント**を提供しています。

### 1. oRPC エンドポイント (Type-safe RPC)

**エンドポイントベース:** `/api/rpc/*`（すべてのRPCコール）

**特徴:**
- ✅ 完全な型安全性（クライアント・サーバー間で型を共有）
- ✅ 自動的なOpenAPI仕様生成
- ✅ Zodスキーマベースのバリデーション
- ✅ JSON形式のリクエスト/レスポンス
- ✅ SSEによるリアルタイム購読（subscription）

**実装場所:**
- ルーター定義: `apps/server/src/infrastructure/api/routers/`
- ルーター組み合わせ: `apps/server/src/domain/shared/api-contract.ts`
- エントリーポイント: `apps/server/src/infrastructure/api/app.ts`

**使用例:**
```typescript
import { createORPCClient } from "~/infrastructure/api-clients/orpc-client";

const client = createORPCClient();

// 型安全な呼び出し
const result = await client.media.search({
  sourceId: "uuid",
  params: { condition: { type: "group", operator: "and", children: [...] } }
});
// ↑ 型が自動推論される
```

**詳細:** `orpc-api` スキルを参照

### 2. RESTエンドポイント (Binary Content)

**用途:** バイナリコンテンツ（画像、動画、ZIPなど）の配信

oRPC は JSON ベースのため、バイナリコンテンツは専用の REST エンドポイントで提供します。

**主なエンドポイント:**
- `GET /api/sources/:mediaSourceId/:mediaId` - メディアファイル本体
- `GET /api/sources/:mediaSourceId/:mediaId/thumbnail` - サムネイル (WebP)
- `GET /api/sources/:mediaSourceId/dump` - ダンプエクスポート (JSON/ZIP)
- `POST /api/sources/:mediaSourceId/import` - ZIPインポート

**実装場所:** `apps/server/src/infrastructure/api/app.ts`

**使用例:**
```html
<!-- 画像の表示 -->
<img src="/api/sources/{mediaSourceId}/{mediaId}" alt="media" />

<!-- サムネイル -->
<img src="/api/sources/{mediaSourceId}/{mediaId}/thumbnail" alt="thumbnail" />
```

---

## 共通原則

-   **型安全性**: oRPC により、クライアントとサーバー間で型定義を共有
-   **スキーマ駆動**: すべてのデータ構造は Zod スキーマで定義
-   **エラーハンドリングの統一**: カスタムエラークラスを使用（`ResourceNotFoundError` など）
-   **Safe DTO**: 機密情報（パスワード、APIキー）はレスポンスに含めない
-   **OpenAPI自動生成**: Zodスキーマから自動的にドキュメント生成

## セキュリティ (Security)

API設計においては、以下のセキュリティ対策を講じています。

### Safe DTO (Data Transfer Objects)

-   データベースに保存されている機密情報（パスワード、秘密鍵、APIキーなど）は、APIレスポンスに含まれてはいけません。
-   必ず `SafeMediaSource` のような、機密情報を除外したDTO（Data Transfer Object）を使用してください。
-   OpenAPIスキーマ定義においても、機密情報が含まれないスキーマを参照するようにしてください。

---

## エンドポイント一覧

以下に、現在実装されているAPIエンドポイントをoRPCプロシージャ形式で示します。

> **表記方法**: `router.procedure` 形式。`query` = 読み取り(GET相当)、`mutation` = 書き込み(POST/PUT/DELETE相当)、`subscription` = SSE購読。

### メディアソース (Sources) - `sources.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `sources.list` | query | 全てのメディアソースを取得します。 |
| `sources.get` | query | 特定のメディアソースを取得します。 |
| `sources.create` | mutation | 新しいメディアソースを作成します。 |
| `sources.update` | mutation | 特定のメディアソースを更新します。 |
| `sources.delete` | mutation | 特定のメディアソースを削除します。 |
| `sources.sync` | mutation | メディアソースを同期します（複数指定可）。 |
| `sources.dump` | query | メディアソースをダンプエクスポートします（JSON/ZIP）。 |
| `sources.restore` | mutation | JSONダンプからメディアメタデータを復元します。 |
| `sources.importZip` | mutation | ZIPファイルからメディアソースをインポートします。 |
| `sources.status` | query | メディアソースの状態を取得します。 |
| `sources.events` | subscription | メディアソースのSSEイベントを購読します。 |

### メディア (Media) - `media.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `media.search` | query | メディアを検索します（グローバル検索対応）。 |
| `media.get` | query | 特定のメディアを取得します。 |
| `media.getDetails` | query | タグ・カテゴリ・IP・キャラクターを含む詳細情報を取得します。 |
| `media.getTags` | query | 特定メディアのタグを取得します。 |
| `media.update` | mutation | 特定のメディア情報を更新します。 |
| `media.sync` | mutation | メディアのメタデータを再抽出します（複数指定可）。 |
| `media.delete` | mutation | 特定のメディアを削除します。 |
| `media.copy` | mutation | メディアを指定ソースにコピーします。 |
| `media.move` | mutation | メディアを指定ソースに移動します。 |
| `media.upload` | mutation | メディアファイルをアップロードします。 |

#### 検索スキーマ (`mediaSearchRequestSchema`)

`media.search` は複合的な検索条件をサポートする `SearchGroup` 構造を使用します。

```typescript
{
  condition?: SearchGroup,  // ネスト可能な検索条件グループ
  sort?: "date" | "name" | "size" | "rating" | "viewCount",
  order?: "asc" | "desc",  // デフォルト: "desc"
  limit?: number,           // 正の整数
  offset?: number           // 0以上、デフォルト: 0
}
```

**SearchGroup 構造:**
```typescript
{
  type: "group",
  operator: "and" | "or",
  negate?: boolean,
  children: Array<
    | SearchGroup  // ネスト
    | {           // 検索条件
        type: "condition",
        target: SearchTarget,
        operator: SearchOperator,
        value?: string
      }
  >
}
```

**SearchTarget:** `keyword`, `fileName`, `filePath`, `description`, `mediaType`, `width`, `height`, `fileSize`, `createdAt`, `rating`, `favorite`, `viewCount`, `aiGenerated`, `tag`, `author`, `project`, `ip`, `character`, `folder`

**SearchOperator:** `equals`, `contains`, `startsWith`, `endsWith`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `isEmpty`, `isNotEmpty`

### ディレクトリ (Directories) - `directories.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `directories.list` | query | 指定パス以下のディレクトリ一覧を取得します。 |
| `directories.create` | mutation | 新しいディレクトリを作成します。 |
| `directories.delete` | mutation | ディレクトリを削除します。 |
| `directories.rename` | mutation | ディレクトリ名を変更します。 |

### タグ (Tags) - `tags.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `tags.list` | query | 全てのタグを取得します。 |
| `tags.get` | query | 特定のタグを取得します。 |
| `tags.create` | mutation | 新しいタグを作成します。 |
| `tags.update` | mutation | 特定のタグを更新します。 |
| `tags.delete` | mutation | 特定のタグを削除します。 |

### カテゴリ (Categories) - `categories.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `categories.list` | query | 全てのカテゴリを取得します。 |
| `categories.get` | query | 特定のカテゴリを取得します。 |
| `categories.create` | mutation | 新しいカテゴリを作成します。 |
| `categories.update` | mutation | 特定のカテゴリを更新します。 |
| `categories.delete` | mutation | 特定のカテゴリを削除します。 |

### プロジェクト (Projects) - `projects.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `projects.list` | query | 全てのプロジェクトを取得します。 |
| `projects.get` | query | 特定のプロジェクトを取得します。 |
| `projects.create` | mutation | 新しいプロジェクトを作成します。 |
| `projects.update` | mutation | 特定のプロジェクトを更新します。 |
| `projects.delete` | mutation | 特定のプロジェクトを削除します。 |
| `projects.listForMedia` | query | 特定メディアに関連付けられたプロジェクトを取得します。 |
| `projects.addToMedia` | mutation | 特定メディアにプロジェクトを追加します。 |
| `projects.removeFromMedia` | mutation | 特定メディアからプロジェクトを削除します。 |

### キャラクター (Characters) - `characters.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `characters.list` | query | 全てのキャラクターを取得します。 |
| `characters.get` | query | 特定のキャラクターを取得します（IP情報含む）。 |
| `characters.create` | mutation | 新しいキャラクターを作成します。 |
| `characters.update` | mutation | 特定のキャラクターを更新します。 |
| `characters.delete` | mutation | 特定のキャラクターを削除します。 |
| `characters.listForMedia` | query | 特定メディアに関連付けられたキャラクターを取得します。 |
| `characters.addToMedia` | mutation | 特定メディアにキャラクターを追加します。 |
| `characters.removeFromMedia` | mutation | 特定メディアからキャラクターを削除します。 |

### IP (Intellectual Properties) - `ips.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `ips.list` | query | 全てのIPを取得します。 |
| `ips.get` | query | 特定のIPを取得します。 |
| `ips.create` | mutation | 新しいIPを作成します。 |
| `ips.update` | mutation | 特定のIPを更新します。 |
| `ips.delete` | mutation | 特定のIPを削除します。 |
| `ips.listForMedia` | query | 特定メディアに関連付けられたIPを取得します。 |
| `ips.addToMedia` | mutation | 特定メディアにIPを追加します。 |
| `ips.removeFromMedia` | mutation | 特定メディアからIPを削除します。 |

### 著者 (Authors) - `authors.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `authors.list` | query | 全ての著者を取得します。 |

### サムネイル (Thumbnails) - `thumbnails.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `thumbnails.generate` | mutation | サムネイルの手動生成を開始します。 |
| `thumbnails.clear` | mutation | サムネイルキャッシュをクリアします。 |

### ダウンロード (Downloads) - `downloads.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `downloads.start` | mutation | JSONから複数の画像を一括ダウンロードして登録します。 |

**`downloads.start` リクエストスキーマ:**
```typescript
{
  mediaSourceId: string,   // UUID
  items: [{                // 最低1件
    targetUrl?: string,    // ダウンロードURL
    filePath?: string,     // ローカルパス
    fileName?: string,     // ファイル名
    cookies?: string,      // HTTP Cookie
    userAgent?: string,    // User-Agent
    description?: string,  // 説明（Markdown形式）
    sourceUrls?: string[], // ソースURL
    authors?: AuthorInfo[],
    tags?: string[],
    characters?: string[],
    ips?: string[],
    projects?: string[],
    generationInfo?: GenerationInfo
  }]
}
```

### インポート (Imports) - `imports.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `imports.bulkAdd` | mutation | 一括インポートリクエストを追加します。 |
| `imports.listPending` | query | 保留中のインポートジョブ一覧を取得します。 |
| `imports.process` | mutation | 指定ジョブを処理します。 |
| `imports.cancel` | mutation | 指定ジョブをキャンセルします。 |
| `imports.events` | subscription | インポート状態のSSEイベントを購読します。 |

### ディレクトリ (Directories) - `directories.*`

（上記ディレクトリセクション参照）

### AI (Artificial Intelligence) - `ai.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `ai.tag` | mutation | 画像のタグ付けを行います（一般タグ、キャラクター、IP）。ファイルアップロードまたはメディアID指定に対応。 |
| `ai.ccipFeature` | mutation | 画像からCCIP特徴量を抽出します。 |
| `ai.ccipDifference` | query | 2つのCCIP特徴量間の差分を計算します。 |
| `ai.scanBatchTaggingTargets` | query | バッチタグ付け対象メディアをスキャンします。 |
| `ai.batchTagging` | mutation | バッチタグ付けを開始します。 |
| `ai.startBatchTaggingWithIds` | mutation | 指定IDのメディアに対してバッチタグ付けを開始します。 |

### ユーティリティ (Utils) - `utils.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `utils.fetchUrl` | query | 指定URLからコンテンツを取得します。 |

### 設定 (Config) - `config.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `config.get` | query | アプリケーション設定を取得します。 |
| `config.update` | mutation | アプリケーション設定を更新します（部分更新可）。 |

### 検索プリセット (Presets) - `presets.*`

| プロシージャ | 種別 | 説明 |
|---|---|---|
| `presets.list` | query | 全ての検索プリセットを取得します。 |
| `presets.get` | query | 特定のプリセットを取得します。 |
| `presets.getByName` | query | 名前でプリセットを取得します。 |
| `presets.create` | mutation | 新しいプリセットを作成します。 |
| `presets.update` | mutation | 特定のプリセットを更新します。 |
| `presets.delete` | mutation | 特定のプリセットを削除します。 |

---

## リアルタイム更新 (Real-time Updates)

SSE（Server-Sent Events）によるリアルタイム更新は、oRPCの `subscription` を使用して提供されます。

### メディアソースイベント (`sources.events`)

| イベントタイプ | データ | 説明 |
|---|---|---|
| `thumbnail-generated` | `{ mediaId: string }` | サムネイル生成完了時 |
| `media-added` | `{ filePath: string, timestamp: string }` | ファイル追加検知時 |
| `media-deleted` | `{ filePath: string, timestamp: string }` | ファイル削除検知時 |
| `media-changed` | `{ filePath: string, timestamp: string }` | ファイル変更検知時 |
| `watcher-error` | `{ error: string, timestamp: string }` | 監視エラー発生時 |

### ファイルシステム監視

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

**注意**: `media-added`と`media-changed`イベントでは即座にrefetchせず、`thumbnail-generated`イベントが来た時にrefetchすることで、サムネイルが表示された状態でUIが更新されます。

---

## 統計情報

- **ルーター数:** 16
- **oRPCプロシージャ数:** ~68
  - **Queries (読み取り):** ~22
  - **Mutations (書き込み):** ~42
  - **Subscriptions (SSE):** 2
- **RESTエンドポイント数:** 4（バイナリ配信用）
