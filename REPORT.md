# UI implementation report

WebとTauriは `DESIGN.md` と Design Lab を基準にした共有ワークスペースを使用します。`/search`、`/sources/:sourceId`、`/manager`、`/jobs`、`/config`、`/about` は検索、ソース操作、メディア管理、AI操作、設定、インポート、データ転送を実データへ接続しています。既存の `/v2/*` URLは対応する通常routeへ転送し、保存済みリンクとの互換性を保ちます。未対応機能は推測データを表示せず無効化しています。

## Current implementation status

| 領域 | 現状 | 主な実装 |
| --- | --- | --- |
| Jobs一覧・詳細・artifact download | 実装済み | `packages/core/src/domain/contract/jobs.contract.ts`、`apps/server/src/infrastructure/api/routers/jobs-router.ts`、`packages/ui/src/screens/jobs-screen.tsx` |
| JobのRetry / Cancel / realtime更新 | 実装済み | Jobs contract/router、`jobs-screen.tsx`、Jobイベント購読 |
| Sourceの件数・同期状態 | 実装済み | `sources-router.ts` の `mediaCount` / `syncStatus` |
| Managerの利用件数 | 実装済み | `entity-media-counts.ts` と Project / IP / Character router |
| Export / Restore | 実装済み | Web / TauriのManagerから転送Jobをキューへ登録し、共有Jobs画面で追跡・ダウンロード |
| AI接続状態・latency | 実装済み | `ai.health` contract/router と Config画面 |
| リロード後の前後メディア移動 | 実装済み | `packages/ui/src/media-context.ts` と sessionStorage |
| Collectionのgrid / list表示 | 実装済み | `packages/ui/src/source-media-grid.tsx` と Search / Source画面 |
| Web / Tauriの共有画面 | 実装済み | `packages/ui/src/layouts/app-shell.tsx`、`screens/`、詳細・モーダル部品。各アプリはAPI・ルーティング・実行環境を接続 |
| Tauriの接続先管理とネイティブ連携 | 維持 | `/servers`、端末内の接続設定、サーバーごとのSQLiteキャッシュ、HTTP・メディア取得 |

未対応の画面やAPIを追加する場合は、loading / error / offline / retryとリアルタイム更新まで同じ画面内で接続します。

## UIの命名と互換性

- 現行画面にはバージョン名を付けず、機能名と `workspace` のデザイン名を使います。Web / Tauriで画面の実装を分けません。
- Tauriの仮ホーム画面や旧ナビゲーション・旧画面部品は廃止し、`/` と `/sources/` は現行の `/search` へ転送します。ソース管理は共有サイドバー、Export / RestoreはManagerから操作します。
- `/v2/*` の転送元URLは互換性のため維持します。保存済みの旧キーは `packages/ui/src/ui-storage.ts` で正規キーへ移行し、新しい書き込みはバージョン名やUI種別で分岐しません。コピーに失敗した場合は元の保存データを残します。

## ブラウザー検証

隔離E2Eは一時PGliteとメディアを使います。Tauriの検証用ブラウザーも実際の `apps/tauri` のエントリーポイント・ルーター・画面を読み込み、同じ隔離APIへ接続します。テスト専用アダプターがネイティブHTTP・設定ストア・SQLite永続化を置き換えるため、この検証でネイティブIPCやSQLite自体の動作確認を代替することはできません。
