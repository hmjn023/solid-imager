---
name: tanstack-db
description: TauriのTanStack DBコレクション、SQLite永続化、live queryを変更する。初期化順序、SQLエラー正規化、schemaVersion、API mutation後の再同期を扱う。
---

# Tauri Data Layer

## 変更箇所

- 永続化adapter: `apps/tauri/src/infrastructure/db/persistence.ts`
- collectionの生成・集約: `apps/tauri/src/collections/`
- 描画前の初期化: `apps/tauri/src/main.tsx`
- API mutation: `apps/tauri/src/api/` または `apps/tauri/src/infrastructure/api-clients/`

serverには現在未導入。TauriのSQLite adapterをそのままserverへ流用しない。

## 維持する制約

- 永続化を一度だけ非同期初期化し、collectionはfactory関数で生成する。モジュール評価時に未初期化の永続化へアクセスしない。
- 最初のcollectionを作って既存の `refetchCollection` で初回取得を待ち、内部テーブルが準備できてから残りを作成する。既存の直列化を崩すと初期化競合が起きる。
- collection初期化が完了してからRouterを描画する。`getCollections()` は初期化済みであることを前提とする。
- Tauri SQLが文字列でrejectする場合はadapterで `Error` へ正規化する。TanStack側の重複カラム判定が機能せず起動が失敗する問題を防ぐ。
- `getKey` はエンティティの一意キーを返す。永続化schemaを変更したら `schemaVersion` を上げる。同期collectionはキャッシュの再取得、ローカル専用データはmigrationを設計する。
- mutationは既存API clientで行い、成功後に対象collectionの `utils.refetch()` を呼ぶ。既存のTanStack Queryとの段階的な共存を保つ。

factory・起動順序・SQLラッパーを変更する時は [実装の参照先](references/implementation.md) を読む。ライブラリAPIを変更する時はインストール済みバージョンと現行ドキュメントを確認する。

## Tauri固有の確認

- RustのSQLプラグインはSQLite featureを有効にし、`lib.rs` で登録する。
- `src-tauri/capabilities/main.json` のSQL権限は `sql:default`、`sql:allow-execute`、`sql:allow-select`、`sql:allow-load`、`sql:allow-close` を確認する。
- DB保存先は `app_config_dir()`（Linuxは `~/.config/{app-identifier}/`、macOSは `~/Library/Application Support/{app-identifier}/`）。ファイル名は `database-files.ts` の `getDatabaseName(serverId)` で決め、接続先ごとのキャッシュを分離する。
- `initializePersistence` は既存インスタンスがあればserverIdを変えてもそのまま返す。接続先変更時は既存の再読み込み・close経路を保ち、旧サーバーのcollectionやキャッシュを流用しない。

## 検証

新しいcollectionの起動・取得、mutation後の再取得、再起動後のキャッシュ復元、schemaVersion変更時の再同期を確認する。データが空なら最初のrefetch待ち、重複カラムエラーならSQLラッパー、SQL権限エラーならcapabilityを調べる。
