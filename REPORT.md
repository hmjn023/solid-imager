# Web UI implementation report

Web UIの通常routeは `DESIGN.md` と Design Lab を基準にした現行ワークスペースです。`/search`、`/sources/:sourceId`、`/manager`、`/jobs`、`/config`、`/about` は検索、ソース操作、メディア管理、AI操作、設定、インポート、データ転送を実データへ接続しています。既存の `/v2/*` URLは対応する通常routeへ転送し、保存済みリンクとの互換性を保ちます。未対応機能は推測データを表示せず無効化しています。

## Current implementation status

| 領域 | 現状 | 主な実装 |
| --- | --- | --- |
| Jobs一覧・詳細・artifact download | 実装済み | `packages/core/src/domain/contract/jobs.contract.ts`、`apps/server/src/infrastructure/api/routers/jobs-router.ts`、`packages/ui/src/screens/jobs-screen.tsx` |
| JobのRetry / Cancel / realtime更新 | 実装済み | Jobs contract/router、`jobs-screen.tsx`、Jobイベント購読 |
| Sourceの件数・同期状態 | 実装済み | `sources-router.ts` の `mediaCount` / `syncStatus` |
| Managerの利用件数 | 実装済み | `entity-media-counts.ts` と Project / IP / Character router |
| Export / Restore | 実装済み | `apps/server/src/components/pages/manager-page.tsx` から転送Jobをキューへ登録し、Jobs画面で追跡・ダウンロード |
| AI接続状態・latency | 実装済み | `ai.health` contract/router と Config画面 |
| リロード後の前後メディア移動 | 実装済み | `apps/server/src/components/media/media-context.ts` と sessionStorage |
| Collectionのgrid / list表示 | 実装済み | `packages/ui/src/source-media-grid.tsx` と Search / Source画面 |
| Tauriの `/v2/*` route adapter | 実装済み | `apps/tauri/src/routes/$.tsx` と `apps/tauri/src/routes/jobs.tsx`。既存Tauri画面へ検索、Manager、Jobs、Config、About、Sourcesを接続 |

未対応の画面やAPIを追加する場合は、loading / error / offline / retryとリアルタイム更新まで同じ画面内で接続します。

## UIの命名と互換性

- Webの現行画面にはバージョン名を付けず、機能名と `workspace` のデザイン名を使います。
- Tauriは独自の画面構成を使用しています。Webの旧UI廃止はTauriの画面移行を意味しません。部品名は利用先やレイアウトを表し、`legacy` で分類しません。
- `/v2/*` の転送元URLと、ブラウザーに保存済みの `v2`／`legacy` を含むキーは互換性のため維持します。これらの文字列は現行UIの名前ではありません。
