# V2 UI migration report

`/v2/*` は `DESIGN.md` と Design Lab を基準にした移行用フロントエンドです。既存APIで成立する検索、ソース操作、メディア管理、AI操作、設定、インポート、データ転送は実データへ接続し、未対応機能は推測データを表示せず無効化しています。

## Backend work required

| 項目 | 現状の原因 | 必要な実装 | V2での扱い |
| --- | --- | --- | --- |
| Jobs一覧・履歴・詳細 | jobs contractはイベント購読のみで、一覧取得APIがない | Job DTO、list/detail query | 既存jobsテーブルからSafe DTOで一覧・詳細を表示。SSEで更新 |
| JobのRetry / Cancel | 対応するuse caseとmutationがない | retry/cancel command、状態遷移、権限制御 | 失敗JobのRetryを実装。Cancelは自然な状態遷移・権限制御が必要なため未対応 |
| Sourceの件数・同期中状態 | `SafeMediaSource`にmedia countとsync lifecycleがない | source summary DTO、集計、sync status event | 既存mediaの集計件数とプロセス内の同期状態を表示。同期イベントで更新 |
| Managerの利用件数 | Project / IP / Character一覧にmedia count等がない | 集計queryまたはsummary DTO | 既存の中間テーブルからProject / IP / Characterの利用件数を表示 |
| Export / RestoreのJobs追跡 | 現行はHTTP download/uploadを直接実行する | job type、progress、artifact、失敗履歴 | 転送自体は実行し、Jobs連携は表示しない |
| AI接続状態・latency | health check contractがない | typed health endpointとtimeout/error定義 | Settingsの確認操作から実際のhealth checkを実行し、状態とlatencyを表示 |
| リロード後の前後メディア移動 | 詳細routeだけでは元のfilter/sort/cursorを復元できない | navigation context永続化、またはneighbor query | sessionStorageに最大500件の表示コンテキストを保存し、前後移動を提供。コンテキストなしではdisabled |

## Frontend follow-up

| 項目 | 理由 | V2での扱い |
| --- | --- | --- |
| Collectionのlist表示 | 4:3 gridを先行し、listの情報設計とvirtual row実装が未着手 | Name / Type / Dimensions / Size / Modifiedを表示するlistへ切り替え可能 |
| Tauri route adapter | TauriはWebと別のhash routerを持つ | 既存Tauri画面へつなぐ`/v2/*`薄いroute adapterを追加。JobsはWeb側のみ |

バックエンド追加時は、無効状態を消すだけでなく、loading / error / offline / retryとリアルタイム更新まで同じ画面内で接続します。
