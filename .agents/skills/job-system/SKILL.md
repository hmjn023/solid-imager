---
name: job-system
description: solid-imagerの専用background flow、worker枠、media処理要求、batch進捗、lease/recovery、旧jobs移行を扱う。非同期処理・一括操作・AI concurrency・job event変更時に使用する。
---

# Job System

## 実行経路

- 受付は `import_requests`、取得は `download_runs`、固定対象の一括処理は `batch_runs` / `batch_items`、source sync/export/restore は専用source runを正本とする。
- `apps/server/src/infrastructure/jobs/job-worker.ts` は download/batch/source のclaimと共有general枠を調整する。exportは独立1枠。batchは専用media requestを予約するだけで推論しない。
- metadata/thumbnailは `MediaFileWorker`、tagging/CCIPは `MediaAiWorker` が `media_processing_states` のrevision・request ID・leaseを使って計算する。直接APIも要求・観測に限定し、別の実行経路を作らない。
- downloadを先に完了・公開し、source URL保存、media登録と後続工程予約をtransaction/checkpointで保持する。metadataとthumbnailは表示・管理に必要なのでAIの待ち行列で妨げない。
- AI worker枠とAIサービスのnative admission上限を両方維持する。大量入力に比例した推論Promise、待機body、モデルの多重初期化を作らない。

## 変更時の不変条件

- 専用repositoryのlease/token/epoch/CASを通し、結果とcheckpoint・batch試行結果を同じtransactionで確定する。旧ownerによるcommit、取消後のpublish、成功工程の不要な再実行を防ぐ。
- batch対象は作成時に固定し、retryは未完了対象だけを再予約する。共有/独立要求の需要を取消で消さない。親進捗は固定itemの永続outcomeから導出する。
- memory内の無制限全件配列を避け、capture/dispatch/scan/restoreは既存のbounded page/chunkを保つ。
- SSEは更新通知であり正本ではない。`RealtimeEventBus.publishJob` / source publisherと既存hookを使い、再接続・F5後はDB APIで復元する。schemaは `packages/core/src/domain/sources/events.ts`。

## 旧jobsの撤去・rollback

通常runtimeから `IJobRepository`、generic dispatch/handler、旧child投入を再導入しない。Jobs APIは専用run/itemの互換表示で、旧jobsをfallbackに読まない。

旧schema/private repository/snapshot/cutoverはrollback期間の保守用に残る。全16typeとDB distinct type、未知type、親子cascade、shadow、authority、旧writer fenceを監査する。手順は `docs/operations/jobs-migration-matrix.md` と `docs/operations/jobs-runtime-retirement.md`。unknown/cross-familyを処理済み扱いにして消さない。

本番の実観測・統計reset/DDL監査・検証済みbackup・rollback期限が揃うまで `DROP TABLE jobs` を追加しない。テスト成功を本番移行完了の証拠にしない。既存の移行/rollback scriptはbootstrapせずmaintenance DBだけを開く。

## 検証

共有枠・公平性・export1枠・stop drain、競合claim、期限切れlease、cancel/retry、固定item試行履歴を確認する。`job-runtime-isolation.test.ts` は通常コードの旧依存とtype matrixのずれを検知する。

DB/filesystemは隔離fixture、接続競合は所有PostgreSQL、画面復元とSSEはdev/fresh production harnessを使う。AIメモリ問題の調査では実GPU/モデルを読み込まず、mockと上限付きテストで検証し、実行プロセスにmemory capとswap禁止を設定する。明示的に許可された別の実推論検証が必要な場合も先に資源上限を決める。
