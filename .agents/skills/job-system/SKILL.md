---
name: job-system
description: job追加、worker・dispatch、AI concurrency、親子batch進捗、stale recoveryを変更する時に使用する。
---

# Job System

## データフロー

1. jobは`IJobRepository.create`または`createIfUnique`で投入する。
2. `apps/server/src/infrastructure/jobs/job-worker.ts`がAI・thumbnail・source export・generalの4 poolでclaimする。thumbnailとexportは各1枠、`jobs.concurrency` はgeneral、`jobs.aiConcurrency` はAIに適用する。
3. `apps/server/src/infrastructure/services/job-dispatch-service.ts`がjob typeごとのhandlerへ振り分ける。
4. handlerはpayloadをZod schemaでparseしてから処理する。
5. UIへ進捗を出す場合は`RealtimeEventBus.publishJob`だけを使用する。

## Job追加時の必須更新

- dispatchへ明示的な分岐を追加する。未知jobは警告後に完了扱いになるため、登録漏れを残さない。
- AI推論を行うjobは`JobWorker.aiJobTypes`へ追加し、`jobs.aiConcurrency`の対象にする。
- payload schema、成功・失敗、claim pool、stale recoveryのunit testを追加する。
- source単位で直列化が必要なjobはclaim条件とactive keyを実装する。
- media lifecycleから投入する場合はupload、watcher、copy/move、delete、bulk操作を監査する。

## Batch Job

- 親jobは進捗記録でありworkerに実行させない。`status: in_progress`で作成する。
- 子jobへ `parentId` を設定し、親のtotalは `setBatchTotal`、子の結果は `recordBatchChildOutcome` で更新する。attempt検証と前回寄与との差分記録でretry時の二重加算を防ぐ。`processed/failed` を独自に加算しない。親の `updatedAt` 更新も既存repositoryに任せる。
- job event schemaは`packages/core/src/domain/sources/events.ts`を唯一の正とする。
- clientは既存のjob event hookを再利用し、独自pollingやEventSourceを追加しない。

## 検証

`claimPending` のpool分離・枠数、親job非claim、進捗完了・失敗、retry/stale attemptの二重加算防止と回復を確認する。
