# プロジェクトの健全性に関する調査レポート

## はじめに

このレポートは、プロジェクト内部のコードの健全性と、ドキュメントと実装の一貫性に関する調査結果をまとめたものです。調査は、主に以下の2つの観点から行われました。

1.  **ドキュメントと実装の乖離:** データベーススキーマ定義などのドキュメントと、実際のソースコードとの間に食い違いがないか。
2.  **不正な合成:** コードベース内で、型の定義が重複していたり、役割が不明確なコンポーネントが存在したりするなど、設計上の一貫性を損なう問題がないか。

## 調査結果サマリー

調査の結果、いくつかの改善点が明らかになりました。主な問題点は以下の通りです。

- **データベーススキーマの不整合:** 設計ドキュメントとDrizzle ORMによる実際のスキーマ定義との間に、複数の乖離が見られます。
- **型の二重管理:** 同じ目的のデータ構造が、ZodスキーマとTypeScriptの型として別々に定義されており、冗長性の原因となっています。
- **型定義の再利用不足:** アプリケーションサービス層で、ドメイン層で定義された型が再利用されず、インラインで型が再定義されている箇所があります。

これらの問題は、コードの保守性を低下させ、将来的なバグの原因となる可能性があります。以降のセクションで、各問題点の詳細と具体的な改善策を提案します。

---

## 1. ドキュメントと実装の乖離

データベースのスキーマ定義において、設計ドキュメント (`docs/design/04-database-design.md`) とDrizzle ORMによる実際のスキーマ (`drizzle/0000_abandoned_thundra.sql`) との間に、複数の乖離が確認されました。

### 1.1. 実装に存在するがドキュメントに未記載のテーブル

以下のテーブルは、現在のデータベース実装には存在しますが、設計ドキュメントには記載されていません。

- **`jobs`**: 非同期タスクやバックグラウンド処理を管理するためのテーブル。
  ```sql
  CREATE TABLE "jobs" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"type" text NOT NULL,
  	"source_id" uuid,
  	"status" "job_status" DEFAULT 'pending' NOT NULL,
  	"payload" jsonb,
  	"result" jsonb,
  	"error" text,
  	"created_at" timestamp DEFAULT now() NOT NULL,
  	"updated_at" timestamp DEFAULT now() NOT NULL
  );
  ```
- **`presets`**: フィルター条件の保存など、ユーザー設定のプリセットを管理するためのテーブル。
  ```sql
  CREATE TABLE "presets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" text NOT NULL,
  	"value" jsonb NOT NULL,
  	"created_at" timestamp DEFAULT now() NOT NULL,
  	CONSTRAINT "presets_name_unique" UNIQUE("name")
  );
  ```

### 1.2. ドキュメントに記載されているが実装に存在しないカラム

以下のテーブルで、設計ドキュメントに記載されているカラムが実装から欠落しています。

| テーブル | 欠落しているカラム | ドキュメントでの説明 |
| :--- | :--- | :--- |
| `collections` | `description` | コレクションの説明 |
| `collections` | `created_at` | 作成日時 |

**注記:** `tags.source`, `characters.source`, `ips.source`, `media_tags.confidence`, `media_characters.confidence` の各カラムは、本レポート作成時点では「実装に存在しない」と記載されていましたが、現在の実装 (`src/infrastructure/db/schema.ts`) には既に存在しています。また、`media_tags`、`media_characters`、`media_ips` テーブルには、メディアへの付与方法を追跡するための `source` カラムが新たに追加されました。

### 1.3. 定義が一致しない項目

- **`media` テーブル:**
  - ドキュメントでは `created_at` と `modified_at` カラムにデフォルト値が指定されていませんが、実装では `DEFAULT now()` が設定されています。これは `GEMINI.md` の定義と一致しています。
- **`similar_media` テーブル:**
  - 実装には `(media1_id, media2_id, algorithm)` に対するユニーク制約が存在しますが、ドキュメントにはこの制約の記述がありません。これは `GEMINI.md` の定義と一致しています。
- **`media_organization` テーブル:**
  - 実装には `ip_id` カラムが存在しますが、ドキュメントのテーブル定義からは漏れています（ただし、インデックス定義のセクションには記載があり、ドキュメント内での不整合も発生しています）。これは `GEMINI.md` の定義と一致しています。
- **`collections` テーブル:**
  - ドキュメントでは `description` と `created_at` カラムが存在しますが、実装 (`drizzle/0000_abandoned_thundra.sql`) では `description` と `created_at` が欠落しており、`updated_at` のみが存在します。`GEMINI.md` の定義では `description` と `created_at` が存在します。この乖離を修正する必要があります。


---

## 2. 不正な合成 (コードの重複・不整合)

コードベース内で、責務が重複していたり、一貫性が欠けていたりする「不正な合成」がいくつか確認されました。

### 2.1. 型の二重管理 (ZodスキーマとTypeScript型)

`src/domain/media/` ディレクトリ配下で、同じデータ構造を表現するためにZodスキーマ (`schemas.ts`) とTypeScriptの型 (`types.ts`) が併用されており、二重管理の状態になっています。

- **具体例:**
  - メディア情報の更新処理において、`src/domain/media/schemas.ts` には `updateMediaRequestSchema` というZodスキーマが定義されています。
  - 同時に、`src/domain/media/types.ts` には `MediaUpdateData` というTypeScriptの型定義が存在します。

  ```typescript
  // In schemas.ts
  export const updateMediaRequestSchema = z.object({
    fileName: z.string().min(1, "File name cannot be empty").optional(),
    description: z.string().optional(),
    sourceUrl: z.string().url("Invalid URL format").optional(),
    // ...
  });

  // In types.ts
  export type MediaUpdateData = {
    filename?: string;
    description?: string;
    sourceUrl?: string;
    tags?: string[];
  };
  ```

この二重管理は、片方の定義を変更した際にもう片方を修正し忘れるというヒューマンエラーを誘発しやすく、バグの原因となります。

### 2.2. 型定義の再利用不足

アプリケーションサービス層 (`src/application/services/`) で、ドメイン層で定義された型を再利用せず、インラインで独自の型定義を行っている箇所が見られます。

- **具体例:**
  - `src/application/services/media-service.ts` の `updateMedia` メソッドでは、引数 `_mediaData` の型がインラインで定義されています。これは、前述の `MediaUpdateData` 型とほぼ同等であり、再利用が可能です。

  ```typescript
  // In media-service.ts
  updateMedia(
    _sourceId: string,
    _mediaId: string,
    _mediaData: { // ← インラインでの型定義
      filename?: string;
      description?: string;
      sourceUrl?: string;
      tags?: string[];
    }
  ) {
    // ...
  }
  ```

### 2.3. 命名の不整合

関連性の高い型やスキーマ間で、命名に一貫性がないため、コードの可読性を損なっています。

- **具体例:**
  - メディアのアップロード機能において、`src/domain/media/schemas.ts` では `addMediaRequestSchema` というZodスキーマが定義されています。
  - 一方で、`src/domain/media/types.ts` では、類似の目的を持つ型が `UploadRequest` という名前で定義されています。

これらの命名の不一致は、開発者がどの型やスキーマを使用すべきか判断するのを困難にします。

---

## 3. 改善に向けた推奨事項と解決方針

以上の調査結果に基づき、プロジェクトの健全性を向上させるための具体的な解決方針を以下に提案します。

### 方針1: 型の責務を明確化し、信頼できる情報源(SSoT)を確立する

#### 1.1. 問題点
- **型の定義の重複:** `src/domain/media/schemas.ts` (Zodスキーマ) と `src/domain/media/types.ts` (TypeScript型) で、同じ目的を持つ型が二重に管理されています。
- **型の役割の不明確さ:** Drizzleが生成するデータベースエンティティ型と、Zodが生成するDTO(データ転送オブジェクト)型の使い分けが曖昧です。

#### 1.2. 解決方針
1.  **DTO (データ転送オブジェクト) の SSoT として Zod スキーマを定める**
    -   **役割:** APIリクエストの入力値のバリデーションや、アプリケーション内でのデータ転送に責任を持つ。
    -   **具体策:** Zodの `z.infer` 機能を活用し、スキーマ定義からTypeScriptの型を自動生成します。これにより、手動で管理されている `src/domain/media/types.ts` は不要となり、廃止します。
    -   **使用箇所:** 主にプレゼンテーション層とアプリケーション層。

2.  **データベースエンティティの SSoT として Drizzle スキーマを定める**
    -   **役割:** データベースのテーブル構造を忠実に反映し、永続化層でのデータ操作に責任を持つ。
    -   **具体策:** Drizzleがスキーマファイルから自動生成する型をそのまま利用します。
    -   **使用箇所:** 主にインフラストラクチャー層（リポジトリなど）。

3.  **アプリケーション層で型のマッピングを行う**
    -   アプリケーションサービスは、DTO（Zod由来の型）とデータベースエンティティ（Drizzle由来の型）の間の変換ロジックに責任を持ちます。これにより、外部からの入力仕様の変更がデータベース構造に直接影響を与えることを防ぎます。

### 方針2: 命名規則を統一し、可読性を向上させる

#### 2.1. 問題点
- `addMediaRequestSchema` と `UploadRequest` のように、関連する型やスキーマの命名に一貫性がなく、コードの可読性を損なっています。

#### 2.2. 解決方針
1.  **ZodスキーマとTypeScriptの型に明確な命名規則を導入する**
    -   **Zodスキーマ:** `PascalCase` + `Schema` サフィックス（例: `UpdateMediaRequestSchema`）
    -   **TypeScript型:** `camelCase`、サフィックスなし（例: `updateMediaRequest`）
2.  **既存のスキーマと型の名前をこの規則に沿ってリファクタリングする**
    -   これにより、`UpdateMediaRequestSchema` から `z.infer` で生成される型が `UpdateMediaRequest` となることが規約から明確になり、開発者の混乱を防ぎます。

### 方針3: 実装を正としてドキュメントを同期させる

#### 3.1. 問題点
- 設計ドキュメントとDrizzleによる実際のスキーマ定義が一致しておらず、開発の混乱を招く可能性があります。

#### 3.2. 解決方針
1.  **Drizzleスキーマ定義を信頼できる唯一の情報源(SSoT)と位置づける**
    -   原則として、**実装（Drizzleスキーマ）が常に最新かつ正しい状態**であるとし、ドキュメントはそれに追従する形でメンテナンスを行います。
2.  **実装に存在する定義をドキュメントに反映する**
    -   **未記載のテーブル:** `jobs`, `presets` テーブルの定義と目的をドキュメントに追記します。
    -   **未記載のカラム:** `media_organization.ip_id` などのカラムをドキュメントに追加します。
    -   **定義の差異:** `media` テーブルのデフォルト値や `similar_media` テーブルのユニーク制約などをドキュメントに反映させます。
3.  **ドキュメントにのみ存在するカラムは「要実装」として扱う**
    - `tags.source`, `media_tags.confidence` といったカラムは、**すべて必要な機能**と判断します。
    - これらを実装すること