# Download run の移行・復旧

対象は [#789](https://github.com/hmjn023/solid-imager/issues/789)、親は [#621](https://github.com/hmjn023/solid-imager/issues/621)。downloadImage の入力・実行・取消・結果・登録checkpointを `download_runs` に移す。generic job worker は download を claim/dispatch しない。

## 実行・予約の契約

Downloads API、import承認、deferred action の予約を共通 service に集める。import承認と予約は同じ transaction。同じ source・入力の active run は一意制約でまとめ、要求ごとの receipt は canonical ID を持つ alias として保存する。空 description と未指定は旧 producer と同じ意味に正規化する。HTTP(S) URL を受け付ける。

専用 DownloadWorker は既存 JobWorker の general 枠を共有し、download用の独立polling queueは作らない。先にclaimする側を交互にして他のgeneral処理を飢餓状態にしない。metadata・thumbnail・AIの独立枠とdownload rate limiterは維持する。

claimはDB transactionとSKIP LOCKEDで行い、attemptとUUID tokenを更新する。UTCのDB時刻を使用し、leaseは120秒、heartbeatは30秒。期限切れclaimだけを再取得し、通常failureは明示retryを待つ。自動crash再取得は初期3回まで。明示retryはattemptをリセットせず、さらに3回のbudgetを与える。

完成ファイルはhidden stagingに置き、公開前にsource URL・完成ファイル情報をcheckpointに保存する。公開・media登録・URL保存・有効4工程予約・checkpoint更新はcurrent lease/token/attemptを検証して行う。既に登録済みのentryは再登録せず、再試行は未完了entryを再開する。source path変更やファイル置換を検知した場合、旧contextを別のファイルへ付けない。

pendingの取消は即時確定。実行中は取消要求を保存し、公開・登録前に拒否する。network/subprocessはheartbeatによるAbortSignalで停止するため、取消停止の反映には最大heartbeat間隔程度かかる。公開済み・登録済みの完成mediaは取消で削除しない。失敗・完了・取消の通知はDB確定後にだけ発行する。

## 切替前

1. downloads.start、import承認、CLI、deferred producer と全旧・新 download worker の受付を止める。旧workerの実行中のdownloadと登録transactionをdrainし、全instanceを停止する。DB gateはdrainの代替ではない。
2. DB snapshot と対象sourceの `.solid-imager-downloads` を含むstagingを復旧可能な状態で保持する。cookieを含むprivate snapshotを公開しない。
3. 旧downloadのID/status/attempt/入力/登録checkpoint・対象source/media/URL/後続工程をprivateに照合できる資料として保存する。
4. 0038 import migrationに続き、0039_stiff_quasar.sqlを通常のmigration手順で適用する。

## Cutover・照合

`apps/server` で接続先を明示する。maintenance commandは専用connectionを開き、workerを起動しない。

```sh
bun scripts/download-run-cutover.ts inspect
bun scripts/download-run-cutover.ts activate --writers-stopped
bun scripts/download-run-cutover.ts inspect
```

PostgreSQLはDB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_DATABASE（またはDB_NAME）、PGliteはDB_HOST=pglite/PGLITE_DATA_DIRを使う。inspectは件数・blocked理由・live lease数を返し、入力・認証・local pathは出力しない。

初回activate（または初回新worker/API）では、authority=legacy/generation=0のcontrolをlockし、jobs tableをlockして250行ずつ旧ID/入力/checkpointを移す。旧in_progressはdrain済みとしてpendingへ戻し、次のclaimで新token/attemptを取得する。取消要求済みはcancelled。入力・source・checkpointの不整合、未知状態、未移行の親を持つactive downloadはblockedに保存する。

同じ入力の重複はaliasへまとめる。複数の完成checkpointなど自動で統合できない状態はblocked。invalid/ambiguous checkpointと同じ入力の空runも自動再downloadしない。blockedの自動修復UIは含めず、operatorがprivate snapshot、staging inode/mtime、media/URL登録実績を照合する。

入力・checkpoint・移行行・元行snapshotをauthorityがlegacyの間にshadow比較し、不一致は全transactionをrollbackする。全元行をprivate `download_run_legacy_snapshots` に保持した後、旧download行だけを削除し、authority=dedicated/generation=1にする。triggerは旧producer/workerのINSERT/UPDATE/DELETEを拒否し、旧transaction snapshotからのwriteもrow lockでfenceする。

受付再開前に移行件数、全ID、status対応、alias/blocked数、入力/checkpoint、snapshot、既存media/URL/後続要求をprivate資料と再照合する。移行によって新しいdownloadやmedia登録が実行されていないことを確認する。import側を初めて切り替える場合は、download cutover後にimport cutoverを行う。旧import予約の検知は旧jobsと専用download runの双方を確認する。

初期運用はsingle server instance。既存Jobs API/画面は専用runからsafeな互換DTOを投影し、専用Downloads list/get/retry/cancelも使える。SSEは更新通知に限定し、再起動/F5/再接続後はDB APIから復元する。複数instanceの通知はjobs削除前にoutbox/pub-subを別issueで扱う。

## Rollback

1. 全download producer/workerとimport承認を停止・drainし、DB/source/stagingをsnapshotする。
2. inspectのliveLeasesが0であることを確認する。生きたleaseがあればrollbackは拒否する。強制的にtokenを無効化せず、停止済みworkerのlease expiryまたは正常なdrainを待つ。
3. `bun scripts/download-run-cutover.ts rollback --writers-stopped` を実行し、復元件数・logical outcome・予約・checkpoint・source/fileを照合する。
4. 互換性のある旧バージョン（このstackの#793まで）だけを起動する。ブラウザも再読み込みする。

rollbackは元行のprivate snapshotに現在の状態・attempt・checkpointを投影し、新規native runも旧download行として復元する。完成runをpendingへ戻さず、登録済みmedia/URL/後続工程を削除しない。aliasを複数のpendingへ戻さない。失効したin_progressはpendingへ戻す。ID衝突は上書きせず、全rollbackを中断する。

authorityはlegacyとなりgenerationを増やす。新API/workerは勝手に再cutoverできない。再度dedicatedへ進める場合は復旧snapshotからの再開か、復元後の変更を照合する別migrationが必要。generationを手で0に戻さない。

private snapshot/checkpoint/stagingはrollback期間中保持する。最低7日間を目安に新旧件数・失敗・再試行・取消・URL/工程予約を観測し、rollback期限と保持対象をoperatorが明示してからarchive/cleanupを別途行う。この実装では稼働DBの移行や観測期間完了、jobs削除を実施しない。batchは#790、source sync/export/restoreは#791、参照ゼロ監査と最終削除は#792。
