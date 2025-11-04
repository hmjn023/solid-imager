# テストの状況

このドキュメントは、プロジェクトのテストスイートの現在の状況をまとめたものです。

## 削除された重複テスト

以下のファイルは、重複していたため削除されました。

- `src/tests/api/media/delete-media-test.ts`
- `src/tests/api/media/get-media-test.ts`
- `src/tests/api/media/list-media-test.ts`
- `src/tests/api/media/update-media-test.ts`

## スキップされたプレースホルダーテスト

以下のファイルは、API エンドポイントの契約を定義するプレースホルダーテストです。これらはまだ実装されておらず、テスト実行時にスキップされるように `it.skip()` または `test.skip()` が適用されています。これらのテストは、将来の機能実装時に利用される予定です。

- `src/tests/api/categories/category-id-test.ts`
- `src/tests/api/categories/index.test.ts`
- `src/tests/api/characters/character-id-test.ts`
- `src/tests/api/characters/index.test.ts`
- `src/tests/api/ips/index.test.ts`
- `src/tests/api/ips/ip-id-test.ts`
- `src/tests/api/media/add-media.test.ts`
- `src/tests/api/sources/[mediaSourceId]/[mediaId]/charactors.test.ts`
- `src/tests/api/sources/[mediaSourceId]/[mediaId]/details.test.ts`
- `src/tests/api/sources/[mediaSourceId]/[mediaId]/ips.test.ts`
- `src/tests/api/sources/[mediaSourceId]/[mediaId]/metadata.test.ts`
- `src/tests/api/sources/[mediaSourceId]/[mediaId]/tags.test.ts`
- `src/tests/api/tags/index.test.ts`
- `src/tests/api/tags/tag-id-test.ts`

また、以下のファイルも API のコントラクトを定義するプレースホルダーテストですが、重複ファイルとして削除されたものとは別に存在しています。これらも同様に `it.skip()` が適用されています。

- `src/tests/api/media/delete-media.test.ts`
- `src/tests/api/media/get-media.test.ts`
- `src/tests/api/media/list-media.test.ts`
- `src/tests/api/media/update-media.test.ts`

## 統合テストの概要

`src/tests/integration` ディレクトリには、アプリケーションの複数のコンポーネント（API クライアント、データベース、サービス層など）が連携して正しく機能するかを検証する統合テストが含まれています。これらのテストは、実際のデータベース接続を使用して実行され、システム全体の動作を保証します。

主な統合テストのカテゴリは以下の通りです。

- **API クライアントの統合テスト**: `src/tests/integration/media/` ディレクトリ内のテストは、`~/infrastructure/api-clients/media.ts` で定義された API クライアントが、バックエンドサービスと正しく連携できるかを検証します。
- **データベースクエリの統合テスト**: `src/tests/integration/queries/` ディレクトリ内のテストは、`~/infrastructure/db/queries/` で定義されたデータベースクエリが、Drizzle ORM を介して PostgreSQL データベースと正しくやり取りできるかを検証します。これには、CRUD 操作、検索、フィルタリングなどが含まれます。
- **設定 API の統合テスト**: `src/tests/integration/config-api.spec.ts` は、設定管理 API が正しく動作するかを検証します。
- **サムネイル API の統合テスト**: `src/tests/integration/thumbnails-api.spec.ts` は、サムネイル生成および取得 API が正しく動作するかを検証します。

これらの統合テストは、アプリケーションの主要な機能が期待通りに動作することを保証するための重要な役割を担っています。

## 今後の実装方針

これらのスキップされたテストは、対応する API エンドポイントが実装される際に、実際の機能テストとして完成させる必要があります。実装時には、`it.skip()` を `it()` に戻し、モックデータではなく実際の API 呼び出しとデータベース操作を検証するようにテストロジックを更新してください。
