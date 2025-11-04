# ドメイン層 (`src/domain`)

このドキュメントでは、`src/domain`ディレクトリ内の各ドメインの役割と、それに含まれるファイル（`types.ts`, `schemas.ts`など）について解説します。

ドメイン層は、このアプリケーションのビジネスルールとエンティティを定義する、最も中心的なレイヤーです。

## ドメイン一覧

### `categories`

-   **役割**: メディアを分類するための「カテゴリ」に関するドメイン。
-   **ファイル**:
    -   `types.ts`: `CategoryData`型を定義。カテゴリの作成・更新時に使用されるデータ構造です。
    -   `schemas.ts`: **未実装** (プレースホルダー)。将来的にカテゴリIDなどのZodスキーマを定義する予定です。

### `characters`

-   **役割**: メディアに登場する「キャラクター」に関するドメイン。
-   **ファイル**:
    -   `types.ts`: `CharacterData`型を定義。キャラクターの作成・更新時に使用されます。
    -   `schemas.ts`: **未実装** (プレースホルダー)。将来的にキャラクターIDなどのZodスキーマを定義する予定です。

### `ips`

-   **役割**: キャラクターが属する「IP（知的財産）」に関するドメイン。
-   **ファイル**:
    -   `types.ts`: `IpData`型を定義。IPの作成・更新時に使用されます。
    -   `schemas.ts`: **未実装** (プレースホルダー)。将来的にIP IDなどのZodスキーマを定義する予定です。

### `media`

-   **役割**: アプリケーションの中核である「メディア」に関するドメイン。メディアの更新データ、メタデータ、検索パラメータなど、多様な型とスキーマを定義します。
-   **ファイル**:
    -   `types.ts`: `MediaUpdateData`, `MediaMetadata`, `UploadRequest`など、メディア操作に関連する多数の型を定義します。
    -   `schemas.ts`: `mediaTypeSchema`, `addMediaRequestSchema`, `updateMediaRequestSchema`など、メディア関連のデータ構造を検証するためのZodスキーマを定義します。
    -   `processing/image-processor.ts`: 画像、動画、音声の処理（サムネイル生成、メタデータ抽出など）を行う`ImageProcessor`等を定義。**現在はすべて未実装**です。
    -   `utils/hash-utils.ts`: MD5や知覚ハッシュを生成するための`HashUtils`を定義。**現在はすべて未実装**です。
    -   `utils/path-utils.ts`: ファイルパスの操作（ファイル名取得、拡張子取得など）を行う`PathUtils`を定義。**現在はすべて未実装**です。

### `shared`

-   **役割**: 複数のドメインで共通して使用される型やスキーマを定義します。
-   **ファイル**:
    -   `types.ts`: `Uuid`, `AppConfig`, `SearchOptions`など、汎用的な型を定義します。
    -   `validation.ts`: データ検証を行う`SchemaValidator`を定義。**現在は未実装**です。

### `sources`

-   **役割**: メディアがどこから来たかを示す「メディアソース」に関するドメイン。
-   **ファイル**:
    -   `types.ts`: `MediaSourceTypeEnum`, `ConnectionInfo`, `MediaSourceInfo`など、メディアソースの接続情報や型を定義します。
    -   `schemas.ts`: `mediaSourceIdSchema`, `localConnectionSchema`など、メディアソース関連のデータを検証するためのZodスキーマを定義します。

### `tags`

-   **役割**: メディアに付与される「タグ」に関するドメイン。
-   **ファイル**:
    -   `types.ts`: **未実装** (プレースホルダー)。
    -   `schemas.ts`: **未実装** (プレースホルダー)。

## テスト

ドメイン層のロジックは、アプリケーションの最も重要なルールを定義するため、ユニットテストによってその正当性が検証されます。このレイヤーのテストは、他のどのレイヤーにも依存せず、純粋なビジネスルールのみを対象とします。

詳細は[テスト (`src/tests`)](./05-testing.md)のドキュメントを参照してください。