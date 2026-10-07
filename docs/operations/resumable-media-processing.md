# メディア取り込みの復旧と移行

## 対象

#771 の取り込み復旧に加え、#620 のメタデータ抽出・サムネイル生成・自動タグ付け・full-image CCIP の正本を `media_processing_states` に置く。0037以降、metadata/thumbnail の計算は専用 scheduler だけが行う。tagging/CCIP は既存AIジョブと共通claimを引き続き使用する。

取り込み、upload/scan、watcher更新、copy/moveではメディアと専用要求を同じDB transactionで保存する。新しい `processMedia` ジョブは作らない。AIが有効なら同じtransactionで既存AIジョブを予約する。同じ専用要求を再投入してもAI予約を重ねない。metadata詳細の補完・明示的再抽出は要求を保存して完了を待つ。thumbnailキャッシュ欠損は専用要求だけを保存する。

Jobs の **Current media processing** は現在の媒体×工程の状態、**Processing steps** は選択した旧ジョブの履歴である。旧 `processMedia` / `generate_thumbnail` は専用要求を引き継いで完了を観測する互換経路となる。自動stale復旧はfile処理のterminal failureや試行上限をリセットしない。明示Retryは内部payloadへ印を付け、再要求と同じtransactionで消費する。旧ジョブの取消は観測を停止するが、他の呼び出し元と共有する専用要求は取り消さない。失敗した互換ジョブの **Retry job** は失敗工程を明示的に再要求する。通常の補修はterminal failureとbackoffを維持する。

以下0032〜0036の記述は各migration時点の設計・移行履歴。現在のfile工程の切替と運用は0037の節を参照する。

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

## migration 0034 と自動タグ付け

0034 は task kind に `tagging` を追加し、成功時の推論レスポンスを nullable な `tagging_result` に保存する。0033 の停止・バックアップ手順を使い、旧版 worker と混在させない。既存の AI タグから成功 revision や実行履歴を推測して作らず、次の要求で一度解析する。既存の AI 情報は成功した再解析を保存するまで維持する。

ローカルの PixAI モデルは `v0.9` を明示して呼び出す。tagging revision は indexed input、モデル名・モデル版、実際のネイティブ runtime 版、provider・device・endpoint、前処理/出力契約の `tagging-v1` から固定順序で作る。同じ revision の成功レスポンスを、空の結果も含めて保存・再利用する。provider やモデルを変更しても全件を自動予約するわけではなく、次の通常要求または一括タグ付けで新しい revision を処理する。同じモデル名・版の重みファイルを置き換える運用は検出しないため、その場合は明示的に再解析する。

メディア単位の direct API、取り込み後の `auto_tagging`、一括タグ付けを同じ claim に集約する。AI 計算はトランザクション外で行い、保存時に媒体/source、現在の設定、claim token/revision、job attempt と取消を検証する。古い worker の結果・失敗は新しい状態へ書き込めない。タグ、メディアとキャラクター/IP の AI 関連付け、レスポンスキャッシュ、完了状態を同じトランザクションで更新する。

成功した再解析では古い AI 関連付けを置換する。手動など他の出所の関連付けと confidence は保持し、キャラクターと IP の既存のグローバル関連付けは削除しない。AI 情報を人の判断として採用・却下する履歴モデルは #774 の対象であり、本変更は却下履歴を作らない。

リモート AI はモデル/runtime の識別を公開していないため、別々の要求では永続キャッシュを再利用せず再解析する。同じ設定で同時に到着した要求は実行中の claim を共有する。この制限を外すには、リモート側のモデル識別契約が必要になる。ネイティブ runtime の版を取得できない場合もキャッシュを再利用しない。ネイティブの読み込みに失敗した場合は、推論の失敗として処理状態に記録する。

Jobs の **Current media processing** に **AI tagging** を追加する。AI だけ失敗した場合は `auto_tagging` ジョブの **Retry job** でタグ付けだけを再開し、metadata/thumbnail を再実行しない。生の推論レスポンス・revision・claim・例外は Jobs DTO に含めない。AI source 更新通知は DB commit 後に送る。

一括タグ付けの対象件数と dispatch は同じ revision 判定を利用する。未解析、失敗、入力/設定変更、キャッシュ不整合の画像を選び、空の結果も含む成功済み画像は除外する。強制再解析は成功済み画像も対象とする。全件は固定サイズのページで走査し、成功済みだけのページに出会っても次へ進む。

旧版への rollback では書き込み元を停止し、0034 の列・制約は残せる。旧版は処理状態を更新せず AI 情報を書き換えるため、新版へ戻す前に停止中の DB で tagging 状態だけを無効化する。metadata/thumbnail 状態を消す必要はない。

```sql
DELETE FROM media_processing_states WHERE task_kind = 'tagging';
```

## migration 0035 と full-image CCIP

0035 は task kind に `ccip` と `ccip_embeddings.processing_revision` を追加する。0033 と同じ停止・バックアップ手順で適用し、旧 worker と混在させない。既存ベクトルは削除せず、revision が不明な旧出力から成功状態を作らない。次の通常要求・一括抽出で一度再抽出し、成功したときに置き換える。

CCIP revision は indexed input、モデル名・モデル版、ネイティブ runtime 版、provider・device・endpoint、embedding version・次元数、前処理/出力契約の `full-ccip-v1` を固定順序で生成する。ネイティブ抽出では `ccip-caformer-24-randaug-pruned` を明示する。`native-v1` はローカル抽出契約の版であり、重みファイルの digest ではない。同名・同版の重みを置換した場合は明示的な再抽出が必要となる。remote / 不明な runtime は別要求の永続キャッシュを使わず、同時要求だけを集約する。

媒体別 direct `ccipFeature` API、取り込み後の `extract_ccip_vector`、複数媒体の子 job、batch を共通 claim に接続する。推論は transaction 外で実行し、ベクトル・full region 更新と完了状態を入力・設定・token/revision・job attempt/取消の検証と同じ transaction で保存する。検証済みの claim の出力は、過去ベクトルの `extracted_at` が未来でも置き換える。raw file の特徴量 API は処理状態を作らない。

キャッシュは成功 state とベクトル双方の revision 一致が条件となる。出力だけ消えた場合は再抽出する。失敗中は以前の出力を残すが ready として再利用しない。類似検索も現在の成功 state と出力 revision が一致する anchor/candidate のみを使う。batch 件数と dispatch は同じページ走査を使い、成功済みだけのページも走査を続ける。複数媒体の子 job は各媒体を独立 transaction で保存し、再試行時は同じ revision の成功済み媒体を再利用する。

Jobs の **Current media processing** に **Full-image CCIP** を表示する。失敗した `extract_ccip_vector` の **Retry job** は CCIP のみを再実行する。`ccipVectorStatus` の成功・失敗・実行中は現在状態を参照し、worker がまだ claim していない待機期間だけ既存 jobs を補助参照する。単体の `mediaId` と複数媒体の `mediaIds`、取消を判定する。状態・失敗は再読込後も復元し、生の例外を状態 API へ返さない。

旧版へ rollback した後に新版へ戻す場合は全 writer を停止し、CCIP 状態だけを削除して次の要求で再構築する。0035 の列・制約と既存ベクトルは残せる。

```sql
DELETE FROM media_processing_states WHERE task_kind = 'ccip';
```

## migration 0036 と専用 scheduler の基盤

0036 は `execution_mode`（既存行は `inline`）、JSON の要求入力 snapshot、`available_at`、`max_attempts`（既定5、1〜20）と due/expired 検索の部分 index を追加する。既存行の実行権は変更せず、producer と server startup は引き続き既存 jobs を使用する。この PR では本番で専用 scheduler を起動しない。migration は停止・バックアップ手順で適用する。

専用経路は `IMediaProcessingSchedulerRepository.request` で媒体×工程の要求を永続化し、`MediaProcessingScheduler.runOnce()` で登録された handler の1件を処理する。host は AI と file 用の runner を分け、各 pool の枠内で呼び出す。未登録の task は取得・回復しない。generic job 行は必要ない。handler は既存の canonical revision を使い、`prepare` で transaction 外の抽出・推論・一時生成、`commit(tx)` で業務出力の保存・公開、`cleanup` で一時出力の除去、`afterCommit` で通知を行う。準備途中の失敗時の一時ファイル除去は handler が担当する。設定変更で要求 revision が一致しなくなった場合は失敗として停止し、producer が現在の revision を再要求する。

- claim は `available_at <= DB clock` の pending 行を `FOR UPDATE OF media SKIP LOCKED` で取得し、token と試行回数を同じ transaction で更新する。media → state のロック順を揃え、要求・完了との deadlock を避ける。対象入力が変更・破損していれば実行せず failed にする。
- handler が明示的に transient と分類した失敗だけ再試行する。unknown/invalid input と設定の不一致は恒久失敗。delay は `min(5分, 1秒 × 2^(attempt−1) × 0.75〜1.25)`、日時と jitter の計算は DB 側で行う。
- lease は120秒、heartbeat は30秒。期限切れ heartbeat は lease を復活させない。runner は1回につき最大25件の期限切れ claim を回収し、試行上限未満なら backoff 後の pending、上限なら failed にする。クラッシュも1回の試行として数える。
- 同 revision の通常要求は pending/backoff、実行中、成功、terminal failure を維持する。force も pending/実行中を共有し、待ち時間や上限を迂回しない。成功・terminal failure に対する明示的な force、または新 revision は回数を0にして再予約する。
- 新要求は旧 token を失効させる。旧完了・失敗・heartbeat は新要求へ書けない。scheduled 行は既存 `claim` で取得できず、専用実行権を取り返せない。結果と完了状態は同じ fenced transaction で保存し、完了更新時にも lease を確認する。イベントや cleanup の失敗で成功結果を再試行しない。

### 後続 producer 切替の手順と rollback

`request` は明示的な行単位の実行権移譲であり、feature flag だけの切替として使わない。producer 移行 PR で以下を実装・検証する。

1. upload、watcher、copy/move、maintenance、restore/import、download、direct API、batch の対象工程への投入と旧 worker を停止する。既存 queued/in-progress job を列挙し、取消・完了・再要求対象を reconcile する。
2. 全プロセスを0036の実行権を確認する版以降に揃え、計算中の旧 worker が終了したことを確認する。古い版は `execution_mode` を見ないため mixed-version 運用をしない。
3. 現在の入力・設定から `request` を同じ media 更新 transaction 内で行う。専用 runner と新 producer だけを起動する。旧 queued job を後から再開させない。direct API も専用要求・完了待ちへ移す。
4. DB の pending/available_at/attempt/last_error と保存結果、再起動後の復元を確認する。正確な batch 対象・履歴は #621 の run/items で管理する。

rollback でも双方の投入と worker を停止し、実行中の計算を終了させ、DB・filesystem の出力と旧 job を reconcile する。専用要求の snapshot をバックアップして旧 producer 用に再予約する対象を確定し、旧経路へ戻す対象の scheduled 状態を停止中に無効化してから旧 producer を再開する。単に mode を変更したり、専用行を残したまま旧 worker を動かしたりしない。まだ専用要求のない基盤段階では追加列・index を残して旧版へ戻せる。

## migration 0037 と metadata/thumbnail の本番切替

0037は全状態行に `request_id` を追加する。要求IDは自動retry/lease回収中には維持し、新revisionまたは完了・失敗後のforceで更新する。同revisionでも古いbatch/互換ジョブの観測を新しい再生成へ結び付けない。claim tokenは各実行attemptごとに変わる。

全writerと旧版workerを停止して0037までmigrationを適用し、同じ版・設定のプロセスだけを起動する。起動時にinline file状態をkeyset走査し、現在のindexed inputとcanonical設定で専用要求へ移す。旧claimを失効させ、同revisionの成功済み出力とterminal failureは維持する。欠損した成功出力だけ補修し、未完了・入力変更はpendingにする。旧汎用ジョブは残して観測処理として再開する。状態のない旧queuedジョブも実行時に専用要求を作る。

metadataは `jobs.concurrency` 枠、thumbnailは独立した1枠で実行する。AIと汎用ジョブのpoolは従来どおり。HMRは前世代のfile workerを停止・drainしてから引き継ぐ。SIGINT/SIGTERMもfile workerの現在の計算とheartbeatを維持して完了を待つ。強制終了ではlease回収を使う。新コードではinlineのmetadata/thumbnail claimを行単位のmodeに関わらず拒否する。旧版binaryはこの制限を知らないので混在運用しない。

metadata抽出とthumbnailの一時生成はtransaction外、結果保存・生成タグの置換・状態完了は専用claimでfenceする。thumbnailの一時名はrevision/tokenを含む。通知はcommit後に既存sourceイベントで配信する。ファイル処理は `EAGAIN` / `EBUSY` / `EMFILE` / `ENFILE` / `ETIMEDOUT` / `ECONNRESET` の明示的な一時エラーだけ自動retryする。不明なエラーや不正入力はfailedで停止する。

restoreは復元したmetadata/関連情報を保ち、同じ復元transaction内でthumbnailだけを要求する。一括thumbnail生成は親・子ジョブを進捗観測として残し、実際の生成は専用workerが行う。既存の重複子予約・親件数・Retry履歴の制約は #621 のrun/items移行まで残る。正確なbatch履歴の実装とは扱わない。

要求IDのない旧thumbnailジョブも、初回予約と同じtransactionで要求IDをpayloadへ保存し、forceを消費する。観測ジョブがクラッシュして自動再開しても、同じ要求の完了・失敗を観測し、forceを繰り返さない。

直接APIと互換ジョブは最大120秒待つ。時間切れでも要求はDBに残り、workerが継続する。公開APIの成功レスポンスや既存SSE契約は変更しない。専用要求の一括一覧・待機時刻・terminal失敗を管理する新UIは後続となる。

rollbackは全writer/workerを停止・drainし、DBとfilesystemを照合する。専用要求snapshotと旧ジョブを保存し、旧producerで再予約する対象を確定してからfile状態を無効化して旧版を再開する。modeだけ変更して両workerを動かさない。

## 保証の範囲と残作業

- metadata/thumbnailは専用handler・producer・API・server startupを切替済み。tagging/full-image CCIPの専用実行、専用要求の管理UI、cropのregion state、#621のrun/itemsは後続。#620全体は完了していない。
- 内容ハッシュや監視が未検出の実ファイル変更は対象外。DBに新しい入力が記録された後の古い結果を拒否する。複数プロセスは同じ設定・processor版で運用する。
- DBとファイルシステムは単一トランザクションにならない。2サイズのrename途中や公開直後・DB commit直前の停止では再生成する。2サイズの公開は完全に同時ではない。クラッシュで残った `*.tmp.webp` はworker停止中に除去可能。
- 同じrevisionの通常要求は実作業を共有する。明示的な再抽出／再生成、キャッシュ欠損、lease失効後には同じrevisionでも計算を再実行し得る。exactly-once実行の保証ではない。
- アップロードのファイル保存自体はDB commitの前。上書き前のファイル復元、コピー／移動／download全体の原子化は含まない。
- AI予約は同一ジョブの再試行内で重複を防ぐ。異なるジョブ間の tagging/CCIP 実作業は state claim で集約するが、ジョブ行自体の全 type dedup、retry後の正確なbatch履歴・親件数の再計算は #619 / #621 に残る。
- 公開DTOには工程種別・状態・試行回数・更新時刻だけを返す。パス、revision、claim token、payload、例外詳細は公開しない。詳細はサーバーログのjobId／stepで調べる。

## 回帰検証

```bash
bun run check
bun run test
bun run --cwd apps/server test:e2e -- ccip-flow.spec.ts processing-recovery.spec.ts realtime-preservation.spec.ts --project=desktop
```

`processing-recovery.test.ts` は一時PGliteでproducer予約のrollback、独立工程と明示Retry、DB再オープン、互換観測の取消・再試行、古い結果の拒否、設定変更、backoff/terminal状態の維持、cache補修、inline移行、タグ置換を検証する。`PROCESSING_TEST_POSTGRES_PORT` を指定すれば同じ一時PostgreSQLへ接続し、再オープン専用ケースだけ省略する。scheduler suiteと同じDBを使うため、両suiteは別コマンドで順に実行する。worker unit testはpool分離・drain・poll errorとconfig変更を確認する。E2Eは開発版/新しい本番ビルドで直接アクセス/F5/SPA、旧failedジョブのRetry、SSE再接続、実AI推論を確認する。

`tagging-processing.test.ts` は一時PGliteで推論レスポンス/空結果の再利用、入力・モデル設定変更、同時要求、手動情報の維持、全出力のロールバック、失敗と再試行、取消、削除、batch対象/ページングを検証する。同じスイートを一時 PostgreSQL 18 + pgvector へ最大12接続で実行できる。専用のローカルテストコンテナを `tagging_processing_test` DB / `tagging_test` user / `ephemeral_tagging_test` password で起動し、割り当てた localhost ポートだけを `TAGGING_TEST_POSTGRES_PORT` に指定する。本番 DB の接続設定は使わない。

```bash
TAGGING_TEST_POSTGRES_PORT=<isolated-localhost-port> bun run --cwd apps/server test:integration -- src/tests/integration/media/tagging-processing.test.ts
```

`ccip-processing.test.ts` は一時 PGlite で CCIP キャッシュ、legacy 移行、入力/設定変更、stale success/failure、取消/attempt、削除、ベクトルと full region の rollback、batch 再試行、対象走査、待機状態復元を検証する。最大12接続の専用 PostgreSQL でも同じ suite を実行できる。localhost の一時コンテナの DB `ccip_processing_test` / user `ccip_test` / password `ephemeral_ccip_test` を使い、本番設定には接続しない。

```bash
CCIP_TEST_POSTGRES_PORT=<isolated-localhost-port> bun run --cwd apps/server test:integration -- src/tests/integration/media/ccip-processing.test.ts
```

ブラウザテストは実 PixAI/CCIP 推論、2回目の結果再利用、Jobs の AI 状態表示と再読込後の復元、CCIP の Find Similar と待機中の F5 も検証する。

`processing-scheduler.test.ts` は新要求・重複取得・DB時計・due時刻・retry/backoff/cap・期限回収・旧token拒否・業務出力のrollback・専用/旧経路の実行権を一時 PGlite で確認する。実DBでの SKIP LOCKED と時計ずれは最大8接続の専用 PostgreSQL 18 + pgvector で検証する。localhost の一時コンテナを DB `processing_scheduler_test` / user `processing_test` / password `ephemeral_processing_test` で起動し、本番設定には接続しない。

```bash
PROCESSING_TEST_POSTGRES_PORT=<isolated-localhost-port> bun run --cwd apps/server test:integration -- src/tests/integration/media/processing-scheduler.test.ts
```
