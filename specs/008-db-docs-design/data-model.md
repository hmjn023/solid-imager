# Data Model: DB操作系関数の実装

## 1. 既存のデータベーススキーマ

本機能では、既存のDrizzle ORMで定義されたデータベーススキーマ（`src/infrastructure/db/schema.ts`）を使用します。スキーマの変更は行いません。

主要なエンティティとそれらの関係は以下の通りです。

-   **mediaSources**: メディアソースの基本情報。
-   **medias**: メディアファイルの詳細情報。
-   **tags**: タグ情報。
-   **mediaTags**: メディアとタグの中間テーブル。
-   **mediaDetails**: メディアの評価や閲覧情報。
-   **mediaGenerationInfo**: AI生成メディアのメタデータ。
-   **categories**: カテゴリ情報。
-   **projects**: プロジェクト情報。
-   **ips**: 知的財産（IP）情報。
-   **characters**: キャラクター情報。
-   **mediaCharacters**: メディアとキャラクターの中間テーブル。
-   **mediaOrganization**: メディアのカテゴリ、プロジェクト、IPなどの組織情報。
-   **mediaTechnicalInfo**: メディアの技術情報。
-   **mediaSync**: メディアの同期情報。
-   **viewHistory**: 閲覧履歴。
-   **similarMedia**: 類似メディア情報。
-   **users**: ユーザー情報。
-   **collections**: コレクション情報。
-   **collectionMedia**: コレクションとメディアの中間テーブル。

各テーブルの具体的な定義は`src/infrastructure/db/schema.ts`を参照してください。

## 2. Effect-TSを考慮したデータフロー

Effect-TSを導入することで、DB操作のデータフローは以下のようになります。

1.  **入力**: DB操作関数は、必要な入力パラメータ（ID、データオブジェクトなど）を受け取ります。
2.  **Effectの構築**: 各DB操作関数は、Drizzle ORMのクエリを`Effect.tryPromise`でラップし、`Effect<never, DBError, Result>`のようなEffectを構築します。
    -   `DBError`は、`src/infrastructure/db/errors.ts`で定義されるカスタムエラー型です。
    -   `Result`は、Drizzle ORMの`InferSelectModel`や`InferInsertModel`から導出される型です。
3.  **エラーハンドリング**: DB操作中に発生する可能性のあるエラー（データベース接続エラー、クエリ失敗、データが見つからないなど）は、`DBError`として型安全に表現され、`Effect.fail`で返されます。
4.  **依存性注入**: データベース接続プールやDrizzle ORMの`db`インスタンスは、Effectのコンテキストとして提供されることを検討します。これにより、DB操作関数は直接`db`インスタンスに依存せず、テスト容易性が向上します。
5.  **出力**: 成功した場合は、期待されるデータが`Effect.succeed`で返されます。

このデータフローにより、DB操作の副作用とエラーが明示的に表現され、アプリケーション全体でのデータの一貫性と堅牢性が向上します。