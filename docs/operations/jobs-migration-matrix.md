# Jobs migration matrix

[#621](https://github.com/hmjn023/solid-imager/issues/621) は flow ごとに移行する。2026-10-13 の reader/producer 調査を起点とし、各 cutover 前に稼働 DB の type 集計と新旧の実装を再確認する。実行順の調整は専用 flow 間で行い、media の共通工程予約・lease・revision 管理を維持する。

| type | producer / execution | reader・event・UI | 移行先・issue |
| --- | --- | --- | --- |
| `import_request` | imports.bulkAdd / 非実行。承認で download 予約 | Imports list/count/process/cancel、import SSE、Web/Tauri inbox | `import_requests`、#788。旧 ID の alias・private snapshot・authority gate |
| `downloadImage` | downloads-router、imports承認、deferred action / download worker、rate limiter | checkpoint、Jobs Retry、job/source SSE | download run、#789。完成 download・source URL・media/4工程予約を保持 |
| `processMedia` | 新 producer は media 共通予約へ移行済み / legacy 観測 | Jobs checkpoint/Retry、job/source SSE | media state を正本に履歴・要求 ID を reconcile、#790/#792 |
| `auto_tagging` | bulk tagging dispatch / AI request 観測 | AI status、親進捗、Jobs/Media processing、job/source SSE | 専用 AI request と固定 batch item、#790 |
| `extract_ccip_vector` | ai-router、CCIP dispatch / AI request 観測 | CCIP status、親進捗、Jobs/Media processing、job/source SSE | 専用 AI request と固定 batch item、#790 |
| `bulk_tagging_parent` | ai-router / 非claim | tagging 親進捗、Jobs、job SSE | batch run/items、#790 |
| `bulk_tagging_dispatch` | ai-router / general dispatch | tagging 親進捗、Jobs Retry、job SSE | batch run/items、#790 |
| `batch_ccip_parent` | ai-router / 非claim | CCIP 親進捗、Jobs、job SSE | source 別固定対象を保持した batch run/items、#790 |
| `batch_ccip_dispatch` | ai-router / general dispatch | CCIP 親進捗、Jobs Retry、job SSE | batch run/items、#790 |
| `thumbnail_generation_parent` | source thumbnail batch / 非claim | thumbnail 親進捗、Jobs、job SSE | batch run/items、#790 |
| `generate_thumbnail` | source thumbnail batch / media request 観測 | thumbnail status、Jobs Retry、job/source SSE | media/source/size 一意性を保持、#790 |
| `sync_lancedb` | 現行 producer/handler なし、旧 uniqueness 分岐のみ | legacy source 分類を監査 | #638 の判断と照合、#791/#792 |
| `sync_lancedb_full` | 現行 producer/handler なし、旧 uniqueness 分岐のみ | legacy source 分類を監査 | #638 の判断と照合、#791/#792 |
| `sync_lancedb_delta` | 現行 producer/handler なし、旧 uniqueness 分岐のみ | legacy source 分類を監査 | watermark/CAS と source 直列化を確認、#791/#792 |
| `source_export` | sources-router / source-transfer service、独立 export 枠 | artifact、取消/Retry、source API、job/source SSE、Web/Tauri | source transfer run。artifact/input 所有権と保持期間、#791 |
| `source_restore` | sources-router / source-transfer service、general | artifact、取消/Retry、source API、job/source SSE、Web/Tauri | source transfer run、#791 |

各 flow は writer 停止・drain、active 行の reconcile、epoch/version gate、shadow 照合、片側だけの claim authority、再起動・競合・rollback を条件に切り替える。import の具体的な手順は [import-request-cutover.md](./import-request-cutover.md)。SSE は更新通知として扱い、再接続後は DB API から復元する。

未知 type、producer/reader、payload/checkpoint、event/UI、dedupe/merge の残存参照があれば #792 の削除 gate を通さない。全 flow 移行後の観測期間と参照ゼロ監査を経て、jobs 本体・generic UI/transport を別 PR で削除する。この表と最初の import PR は全体の移行完了を意味しない。
