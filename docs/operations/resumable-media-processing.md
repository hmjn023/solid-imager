# メディア取り込みの復旧と移行

## 対象

#771 の取り込み復旧に加え、#620 の最初の範囲としてメタデータ抽出・サムネイル生成の正本を `media_processing_states` に置く。`processMedia` の工程別チェックポイントは個々のジョブの実行記録として残す。アップロード、`registerAndProcess`（監視／インポート経由）、既存ディレクトリ登録では、メディア行・関連情報・処理ジョブを同じDBトランザクションで保存する。

工程に失敗しても独立した残りの工程は実行する。1工程でも失敗したジョブは `failed` になり、Jobs の詳細に各工程の状態を表示する。原因を解消して **Retry job** を押すと、現在の入力と設定で未完了の工程を再実行する。同じ入力・設定で成功済みの抽出／生成は別ジョブでも再利用する。AI予約の完了は推論完了を意味せず、推論結果は別のAIジョブで確認する。

中断された `in_progress` ジョブは既存workerのstale recoveryによって再キューされる。DB上のチェックポイントは保持され、再claimでattemptが増える。古いattemptやキャンセル済みattemptは、工程結果の保存・サムネイルの公開・heartbeat更新を拒否される。起動時の補修は同じメディア・入力・設定の未完了／失敗ジョブが担当している工程を再予約しない。画像や設定が変わった要求は別に予約できる。失敗ジョブは利用者の明示的なRetryを待つ。

## migration 0032

以前のmigrationで `jobs` は `UNLOGGED` になっている。異常終了時にキューとチェックポイントが消えないよう、0032で **LOGGED** に戻し、nullableな `processing_checkpoint` と補修検索用の部分indexを追加する。既存のジョブを削除・統合しない。チェックポイントのない既存ジョブは初回実行時に初期化する。

`SET LOGGED` はテーブルを書き換え、強いロックとWAL／追加ディスク容量を必要とする。本番適用前に同程度の件数の復元DBで所要時間と空き容量を確認する。

1. API、worker、ファイル監視など、ジョブとメディアを書き込む全プロセスを停止する。通常のComposeでは `app` にworkerが同居している。旧版workerを新版と混在させない。
2. DB、設定、メディア実体、サムネイル／ジョブ用ファイルをバックアップし、復元できることを確認する。
3. 対象環境の設定で `bun run --cwd apps/server db:migrate` を実行する。PGliteでは `bun run --cwd apps/server db:migrate:pglite` を使用する。
4. 下記SQLで通常テーブル（`p`）と新しい列を確認し、新版のプロセスを起動する。
5. テスト用画像を登録し、Jobsの工程表示、完了、失敗後のRetryを確認する。

```sql
SELECT relpersistence FROM pg_class WHERE oid = 'jobs'::regclass;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'jobs' AND column_name = 'processing_checkpoint';
```

ロック獲得には5秒の `lock_timeout` を設定している。タイムアウト時はmigrationのトランザクションがロールバックされるため、書き込み元と長時間トランザクションを確認して再実行する。テーブル書き換えの所要時間が5秒に制限されるわけではない。

問題があれば書き込み元を停止して調査する。緊急に旧版アプリへ戻す場合もLOGGEDと追加列は維持できるが、旧workerはチェックポイントを扱えず工程を再実行する。データごと巻き戻す場合は停止状態で移行前のDB・ファイルの組を復元する。復旧目的で `SET UNLOGGED` に戻さない。

## migration 0033 とメディア単位の状態

0033 は通常の LOGGED テーブル `media_processing_states` を追加する。主キーは `(media_id, task_kind)`、メディア削除時は状態も削除する。ジョブ履歴を削除しても成功状態は残る。状態・claim の整合性は CHECK 制約で守る。

0032 と同様に書き込みプロセスを停止し、バックアップ後に migration を適用して、全プロセスを同じ新版に揃える。旧版workerはメディア単位の実行権を確認しないので混在運用しない。ロールバック時は追加テーブルを残せるが、旧版で処理した後に新版へ戻す場合は、停止中に `media_processing_states` を空にして次回要求で再構築する。旧版による出力変更は新しい状態に反映されないため。

過去のジョブの成功チェックポイントを正本へ自動変換しない。過去に直接実行された処理や設定が不明なので、初めて要求された工程を一度処理して成功状態を作る。既存ジョブはそのまま実行でき、旧形式の予約は初回のみ新しい予約と重複し得るが、実作業は共通のclaimで集約する。既存全件の一括再処理は行わない。

| 実行経路 | 予約・結果の扱い |
| --- | --- |
| upload / watcher追加 / import / scan | mediaとjobの同時保存、共通の予約集約とtask claim |
| watcher更新 | indexed inputの更新とjob予約を同時保存 |
| copy / deferred action | 共通のjob予約集約とtask claim。ファイルコピー自体の原子化は別課題 |
| metadata詳細表示の補完 / 明示的な再抽出 | 共通task claim。明示的な再抽出は成功済みでも更新し、失敗を呼び出し元へ返す |
| thumbnailの要求 / 専用job / 一括生成 | 共通task claim。256/512を一組で作り、キャッシュ欠損時は再生成。「全て再生成」は明示的な再生成要求を保持 |

`requested_revision` は固定順序の入力とtask設定の SHA-256。入力はメディアID、ソースID／パス、相対パス、DB記録の更新日時・サイズ、メディア種別。metadataは抽出ルール、thumbnailは保存先・サイズ・品質・出力サイズを含む。`serializeMediaTaskRevision` の `metadata-v1` / `thumbnail-v1` はprocessorや出力形式を変えたときに更新する。順序に意味を持つ抽出ルール配列はソートしない。

実行時に媒体行をロックしてclaim tokenを発行する。同じrevisionの実行中要求は待ち、完了結果を共有する。heartbeatは30秒、leaseは120秒。失効したleaseや終了／キャンセルされたjob ownerは次の要求で回収する。生存中にleaseを失った処理が計算を続けても、古いtokenでは結果を保存できない。

結果保存時にはjob attempt（job経由の場合）、媒体行、source、taskのtoken/revisionと現在の設定を再確認する。metadata出力・生成タグの置換・完了状態・ジョブチェックポイントを同じトランザクションに保存する。手動など他の出所のタグは維持する。thumbnailは一時ファイルを同じ確認の後にrenameする。古い処理の失敗通知もtoken比較で拒否する。

Jobs の **Current media processing** は現在の入力と設定に対する状態、**Processing steps** は選択したジョブの実行記録。状態行がない場合や入力／設定が変わった場合は現在状態をPendingと表示する。Pendingは処理が必要なことを表し、ジョブの予約済みを保証しない。設定変更だけで全メディアを再予約する機能は含めない。

## 保証の範囲と残作業

- #620 のmetadata/thumbnailのみ。AI推論、regions、#621 のrun/items移行、専用の状態キュー・backoff schedulerは後続。実行の輸送には既存jobs/workerを使う。
- 内容ハッシュや監視が未検出の実ファイル変更は対象外。DBに新しい入力が記録された後の古い結果を拒否する。複数プロセスは同じ設定・processor版で運用する。
- DBとファイルシステムは単一トランザクションにならない。2サイズのrename途中や公開直後・DB commit直前の停止では再生成する。2サイズの公開は完全に同時ではない。クラッシュで残った `*.tmp.webp` はworker停止中に除去可能。
- 同じrevisionの通常要求は実作業を共有する。明示的な再抽出／再生成、キャッシュ欠損、lease失効後には同じrevisionでも計算を再実行し得る。exactly-once実行の保証ではない。
- アップロードのファイル保存自体はDB commitの前。上書き前のファイル復元、コピー／移動／download全体の原子化は含まない。
- AI予約は同一ジョブの再試行内で重複を防ぐ。異なるジョブ間のAI dedup、既存ジョブの統合、他ドメイン出力の保護は #619 / #620 に残る。
- 公開DTOには工程種別・状態・試行回数・更新時刻だけを返す。パス、revision、claim token、payload、例外詳細は公開しない。詳細はサーバーログのjobId／stepで調べる。

## 回帰検証

```bash
bun run check
bun run test
bun run --cwd apps/server test:e2e -- processing-recovery.spec.ts realtime-preservation.spec.ts --project=desktop
```

`processing-recovery.test.ts` は専用の一時PGliteを使用し、登録のロールバック、工程別Retry、DB再オープン後の復旧、古いattemptとキャンセルの拒否、revision変更、起動時補修の重複抑止、別ジョブとの実作業共有、同時要求、設定変更、古い成功／失敗の拒否、キャッシュ修復、タグの置換、DB制約を検証する。E2Eは実際のfailedジョブをseedし、開発版・本番ビルドで直接アクセス／F5／SPA遷移と実workerのRetryを検証する。既存のSSE再接続テストも併せて実行する。
