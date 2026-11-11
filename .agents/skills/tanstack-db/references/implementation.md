# Tauriデータ層の実装の参照先

コレクションや永続化adapterを変更する時は以下の現行実装を読む。ライブラリの一般的な使用例や実装のコピーを別管理せず、プロジェクト固有の制約は [SKILL.md](../SKILL.md) に集約する。

| 変更対象 | 参照先と確認点 |
| --- | --- |
| 新規collection | [tags-collection.ts](../../../../apps/tauri/src/collections/tags-collection.ts): persistence注入、queryClient、AbortSignal、一意キーの設定 |
| query key | [query-keys.ts](../../../../apps/tauri/src/collections/query-keys.ts): 既存Queryのkeyと混同せずcollection用の定義を使う |
| 初期化・集約 | [collections/index.ts](../../../../apps/tauri/src/collections/index.ts): active serverの選択、最初のrefetch待ち、各factoryの登録 |
| 起動・接続先切り替え | [main.tsx](../../../../apps/tauri/src/main.tsx): server settings・API接続先・collectionの初期化順と、再読み込みの経路 |
| SQLite adapter | [persistence.ts](../../../../apps/tauri/src/infrastructure/db/persistence.ts): SQLエラーの正規化、単一インスタンスの取得・close |
| DBファイルの分離 | [database-files.ts](../../../../apps/tauri/src/infrastructure/db/database-files.ts): server IDごとの名前とlegacy default IDの扱い |
