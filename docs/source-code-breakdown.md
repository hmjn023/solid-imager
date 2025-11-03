# ソースコード詳細

このドキュメントは、`src` ディレクトリ以下の主要なソースコードについて、その役割、主要な関数、および実装状況をまとめたものです。
アーキテクチャの全体像については、[./architecture/ARCHITECTURE.md](./architecture/ARCHITECTURE.md) を参照してください。

## `src/application` - アプリケーション層

アプリケーションのユースケースを実装するサービス群が配置されています。ドメイン層とインフラストラクチャ層を協調させて動作します。

### `services/media-source-service.ts`

-   **役割:** メディアソースのCRUD操作や関連ロジックを提供します。
-   **主要な関数/オブジェクト:**
    -   `MediaSourceService`: `fetchSources`, `createSource`, `updateSource`, `fetchSourceById`, `deleteSource` などの関数を提供します。
-   **実装状況:** ✅ 実装済み。フロントエンドから実際に使用されています。

### `services/media-service.ts`

-   **役割:** メディアファイルのCRUD操作や、メタデータ・タグの関連付けなど、メディアに関する中心的なロジックを提供します。
-   **主要な関数/オブジェクト:** (未実装のため、想定される機能を記述)
    -   `createMedia`, `getMediaDetails`, `updateMediaDescription`, `addTagToMedia`, `removeTagFromMedia` など。
-   **実装状況:** ❌ 未実装。ファイルは存在するが、具体的なロジックは書かれていません。

### `services/thumbnail-service.ts`

-   **役割:** サムネイルの生成、取得、キャッシュ管理に関するロジックを提供します。
-   **主要な関数/オブジェクト:** (未実装のため、想定される機能を記述)
    -   `getThumbnail`, `generateThumbnail`, `clearThumbnailCache` など。
-   **実装状況:** ❌ 未実装。

### その他のサービス (`analytics-service.ts`, `category-service.ts` など)

-   **役割:** 分析、カテゴリ管理、一括操作など、各ドメインに特化したユースケースを提供します。
-   **実装状況:** ❌ ほぼすべて未実装。ファイルは存在するが、具体的なロジックは書かれていません。

---

## `src/domain` - ドメイン層

ビジネスロジック、エンティティ、スキーマ定義が含まれます。このレイヤーは他のレイヤーから独立しています。

### `domain/{entity}/schemas.ts` (例: `domain/media/schemas.ts`)

-   **役割:** 各ドメインエンティティのZodスキーマを定義し、データのバリデーションルールを定めます。
-   **主要な関数/オブジェクト:**
    -   `mediaSourceSchema`, `mediaSchema`, `tagSchema` などのZodスキーマオブジェクト。
-   **実装状況:** ✅ 実装済み。データベーススキーマと連携し、アプリケーション全体で利用されています。

### `domain/shared/`

-   **役割:** 複数のドメインにまたがる共有の型定義 (`types.ts`) やAPI仕様 (`api-spec.ts`) を管理します。
-   **実装状況:** ✅ 実装済み。Swaggerのスキーマ定義などで利用されています。

---

## `src/infrastructure` - インフラストラクチャ層

データベースアクセス、外部API連携、ファイルシステム操作など、外部システムとのやり取りを担当します。

### `infrastructure/db/schema.ts`

-   **役割:** Drizzle ORMを使用して、データベースのテーブル、カラム、リレーションを定義します。プロジェクトのデータ構造のSingle Source of Truthです。
-   **主要な関数/オブジェクト:**
    -   `medias`, `mediaSources`, `tags` などのテーブル定義オブジェクト。
    -   `Media`, `NewMedia` などの型定義。
-   **実装状況:** ✅ 実装済み。プロジェクトの根幹をなすファイルです。

### `infrastructure/db/queries/{entity}.ts` (例: `infrastructure/db/queries/media.ts`)

-   **役割:** 各テーブルに対する具体的なCRUDクエリを実装します。アプリケーション層のサービスから呼び出されます。
-   **主要な関数/オブジェクト:**
    -   `selectMediaSources`, `insertMediaSource`, `selectMediaById`, `insertMedia` など、各エンティティに対する `select`, `insert`, `update`, `delete` 関数。
-   **実装状況:** ✅ ほぼ実装済み。主要なエンティティに対する基本的なクエリは網羅されています。

### `infrastructure/storage/`

-   **役割:** メディアソースの種類（local, sftp, s3）に応じたファイルシステム操作の差異を吸収するためのアダプタ（ドライバー）を提供します。
-   **主要な関数/オブジェクト:**
    -   `LocalDriver`, `SftpDriver`, `S3Driver` などのクラス。
    -   `createDriverFromSource`: メディアソースの種類に応じて適切なドライバーを返すファクトリ関数。
-   **実装状況:** ⚠️ 部分的に実装。`LocalDriver` の基本的な機能（ファイル一覧取得など）は実装されていますが、SFTPやS3、およびファイルの書き込み・削除などの機能は未実装またはプレースホルダーです。

---

## `src/routes` - ルーティング層

SolidStartのファイルベースルーティングに基づき、アプリケーションのページとAPIエンドポイントを定義します。

### `routes/` (ページ)

-   **`routes/index.tsx`**: トップページ。現在はSolidStartのデフォルトページ。
-   **`routes/sources/index.tsx`**: メディアソース一覧ページ。
-   **`routes/sources/[mediaSourceId]/index.tsx`**: 特定メディアソース内のメディア一覧ページ。
-   **`routes/sources/[mediaSourceId]/[mediaId]/index.tsx`**: メディア詳細ページ。
-   **実装状況:** ✅ 基本的な実装済み。ただし、メディア一覧や詳細ページは、ドキュメントに記載されているような高度な機能（検索、ソート、詳細情報表示など）は未実装です。詳細は `docs/design/frontend.md` を参照してください。

### `routes/api/` (APIエンドポイント)

-   **役割:** フロントエンドから呼び出されるRESTful APIを提供します。各ファイルが特定のリソース（例: `sources`, `tags`）のエンドポイントを定義します。
-   **主要な関数/オブジェクト:**
    -   `GET`, `POST`, `PUT`, `DELETE` などのHTTPメソッドに対応するハンドラ関数。
-   **実装状況:** ✅ 主要なCRUD操作は実装済み。`openapi.json` に定義されているエンドポイントの多くが機能します。詳細は `docs/design/api-design.md` を参照してください。

---

## `src/components` - コンポーネント層

再利用可能なUIコンポーネントを配置します。

### `components/ui/`

-   **役割:** shadcn/uiにインスパイアされた、基本的なUI部品（`Button`, `Dialog`, `Input`など）を提供します。`@kobalte/core` をベースに構築されています。
-   **実装状況:** ✅ 多くのコンポーネントが実装済みで、アプリケーション全体で使用されています。

### `components/*.tsx` (例: `components/source-card.tsx`)

-   **役割:** 複数のUI部品を組み合わせた、より具体的な機能を持つ複合コンポーネントを提供します。
-   **主要なコンポーネント:**
    -   `SourceCard`: メディアソースの情報を表示するカード。
    -   `SourceFormModal`: メディアソースの追加・編集フォームを持つモーダル。
    -   `UploadMediaModal`: メディアのアップロード機能を提供するモーダル。
-   **実装状況:** ✅ アプリケーションの主要機能に必要なコンポーネントは実装済みです。
