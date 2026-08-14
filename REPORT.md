# V2 UI migration report

`/v2/*` は `DESIGN.md` と Design Lab を基準にした移行用フロントエンドです。検索、ソース操作、メディア管理、AI操作、設定、インポート、データ転送は実データへ接続し、未対応機能は推測データを表示せず無効化しています。

## Current implementation status

| 領域 | 現状 | 主な実装 |
| --- | --- | --- |
| Jobs一覧・詳細・artifact download | 実装済み | `packages/core/src/domain/contract/jobs.contract.ts`、`apps/server/src/infrastructure/api/routers/jobs-router.ts`、`packages/ui/src/screens/v2-jobs-screen.tsx` |
| JobのRetry / Cancel / realtime更新 | 実装済み | Jobs contract/router、`v2-jobs-screen.tsx`、Jobイベント購読 |
| Sourceの件数・同期状態 | 実装済み | `sources-router.ts` の `mediaCount` / `syncStatus` |
| Managerの利用件数 | 実装済み | `entity-media-counts.ts` と Project / IP / Character router |
| Export / Restore | 実装済み | `apps/server/src/routes/v2/manager.tsx` から転送Jobをキューへ登録し、Jobs画面で追跡・ダウンロード |
| AI接続状態・latency | 実装済み | `ai.health` contract/router と V2 Config画面 |
| リロード後の前後メディア移動 | 実装済み | `apps/server/src/routes/v2/media-context.ts` と sessionStorage |
| Collectionのgrid / list表示 | 実装済み | `packages/ui/src/source-media-grid.tsx` と V2 Search / Source画面 |
| Tauriの `/v2/*` route adapter | 対応済み（Jobsを除く） | `apps/tauri/src/routes/v2/`。既存Tauri画面へ検索、Manager、Config、About、Sourcesを接続 |

未対応の画面やAPIを追加する場合は、loading / error / offline / retryとリアルタイム更新まで同じ画面内で接続します。
