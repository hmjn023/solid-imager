# UI implementation report

UIを通常のアプリケーションシェルとして採用しました。検索、ソース操作、メディア管理、AI操作、設定、インポート、データ転送は実データへ接続し、未対応機能は推測データを表示せず無効化しています。画面の実装とURLは通常のルートへ統合し、旧UIのルートと専用の名前空間を削除しています。

## Current implementation status

| 領域 | 現状 | 主な実装 |
| --- | --- | --- |
| Jobs一覧・詳細・artifact download | 実装済み | `packages/core/src/domain/contract/jobs.contract.ts`、`apps/server/src/infrastructure/api/routers/jobs-router.ts`、`packages/ui/src/screens/jobs-screen.tsx` |
| JobのRetry / Cancel / realtime更新 | 実装済み | Jobs contract/router、`jobs-screen.tsx`、Jobイベント購読 |
| Sourceの件数・同期状態 | 実装済み | `sources-router.ts` の `mediaCount` / `syncStatus` |
| Managerの利用件数 | 実装済み | `entity-media-counts.ts` と Project / IP / Character router |
| Export / Restore | 実装済み | `apps/server/src/routes/manager.tsx` から転送Jobをキューへ登録し、Jobs画面で追跡・ダウンロード |
| AI接続状態・latency | 実装済み | `ai.health` contract/router と Config画面 |
| リロード後の前後メディア移動 | 実装済み | `apps/server/src/components/media-context.ts` と sessionStorage |
| Collectionのgrid / list表示 | 実装済み | `packages/ui/src/source-media-grid.tsx` と Search / Source画面 |
| Tauriの画面ルーティング | 実装済み | `apps/tauri/src/routes/` と `apps/tauri/src/routes/jobs.tsx`。検索、Manager、Jobs、Config、About、Sources、メディア詳細を通常URLのアプリケーションシェルへ接続 |

未対応の画面やAPIを追加する場合は、loading / error / offline / retryとリアルタイム更新まで同じ画面内で接続します。
