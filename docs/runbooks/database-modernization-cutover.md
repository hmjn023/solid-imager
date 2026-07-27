# データストア刷新・移行 runbook

この文書は Issue #613（PostgreSQL 18）、#616（CCIP の LanceDB から
pgvector への移行）、#619（background jobs の耐障害化）を、本番データに
適用するときの統合手順である。PostgreSQL 18 の単体リハーサルで使うコマンドと
各スクリプトの安全策は
[`postgresql-18-rehearsal.md`](./postgresql-18-rehearsal.md) も参照する。

PostgreSQL major cutover の gate と CCIP read cutover の gate は独立している。
同じ maintenance window で同時に切り替えず、それぞれの go/no-go と rollback
boundary を個別に承認する。CCIP の 7 日 observation は CCIP read switch 後の条件で
あり、PG18 cutover の前提条件ではない。

> **現在の状態:** コードとリハーサル手順を用意した段階であり、実データの
> cutover は実行していない。本番 DB、LanceDB、volume、compose 定義を変更する
> 操作は、この文書とは別の変更申請・承認・担当者立会いを必要とする。

## 変更しない境界

- job の永続化先は単一の `jobs` テーブルである。job type ごとの中間テーブルは
  作らない。型、queue、dedupe、concurrency、retry、lease の差は job registry と
  `jobs` の列で表現する。
- `compose.pg18-rehearsal.yml` は隔離リハーサル専用である。既定の
  `compose.yml`、`db-data/`、本番 volume を参照させない。
- legacy LanceDB の source dump/snapshot は読み取り専用の証拠物であり、移行先、
  rollback mirror、checkpoint の置き場として再利用しない。
- PostgreSQL 17 の data directory を PostgreSQL 18 から直接開かない。major
  upgrade は custom-format dump/restore だけで行う。
- 既存ファイル、dump、report、checkpoint を上書きしない。再試行では新しい
  run ID と空の移行先を使う。

## 1. 実行記録と前提条件

一回のリハーサルまたは cutover ごとに、UTC の run ID と権限を限定した記録
ディレクトリを作る。以下の変数名は例であり、秘密情報は記録ファイルや shell
history に書かない。

```bash
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="/var/tmp/solid-imager-cutover-${RUN_ID}"
install -d -m 0700 "${RUN_DIR}"
date --iso-8601=seconds
git rev-parse HEAD
```

次を作業記録へ残す。

| 項目 | 必須記録 |
| --- | --- |
| 識別 | run ID、Issue/変更申請、commit SHA、担当者、承認者 |
| 時刻 | 各 phase の開始・終了、write-freeze、最初の PG18 write、read switch |
| 容量 | PG17 data、PG18 volume、Lance source/snapshot/rollback、dump の bytes |
| 所要時間 | dump、restore、migration、`ANALYZE`/validation、CCIP backfill/parity |
| image | compose に記載した tag、稼働 container の image ID/digest、RepoDigest |
| 検証 | source/target JSON report、manifest、checkpoint、parity report、ログ |
| 判断 | 各 go/no-go の判定者、時刻、根拠、未解決事項 |

必要なローカルコマンドは `docker`（Compose v2）、`bun`、`git`、`jq`、
`sha256sum`、`/usr/bin/time` である。開始前に application server と worker を
個別に停止・起動できること、DB と LanceDB の所有者、監視方法、連絡先を確認する。

PostgreSQL image は tag だけで判定しない。リハーサルで、実際に稼働した image
の組を保存する。

```bash
docker compose -f compose.yml config --images
docker inspect --format '{{.Config.Image}}|{{.Image}}' \
  "$(docker compose -f compose.yml ps -q db)"
docker image inspect pgvector/pgvector:pg17 \
  --format '{{json .RepoDigests}}'

docker compose -f compose.pg18-rehearsal.yml config --images
docker image inspect \
  'pgvector/pgvector:0.8.5-pg18-bookworm@sha256:12a379b47ad65289572ea0756efc11b7c241a6662833e8af7038cd3b73d647e0' \
  --format '{{json .RepoDigests}}'
```

本番 PG18 compose は、リハーサルと同じ
`tag@sha256:12a379b...d647e0` を使い、稼働 container の tag と image ID/digest
がリハーサル記録と完全一致しなければならない。一致しない場合は no-go として
新しい image でリハーサルをやり直す。

## 2. PostgreSQL 17 → 18 timed rehearsal

### 2.1 事前条件

1. PG17 source の現在の migration level を記録する。PG18 用 schema migration を
   rehearsal のためだけに PG17 へ先行適用しない。
2. PG18 restore 後に final code revision の `db:migrate` を明示的に実行する。
   source migration 列は target の完全な prefix でなければならない。
3. `compose.pg18-rehearsal.yml` の target image と volume mount
   (`/var/lib/postgresql`) を review する。
4. source と target の空き容量が、source data と custom dump を保持しても十分で
   あることを確認する。

### 2.2 source baseline と custom dump

PG17 source の構造・件数を JSON に固定する。現行 source は vector extension を
持たない前提なので、その不在も baseline として検証する。

```bash
/usr/bin/time -v bun apps/server/scripts/validate-postgres-rehearsal.ts \
  --compose-file compose.yml \
  --service db \
  --expected-major 17 \
  --expect-vector-unavailable \
  --output "${RUN_DIR}/pg17-source.json"

/usr/bin/time -v bun apps/server/scripts/dump-db.ts \
  --compose-file compose.yml \
  --service db \
  --output "${RUN_DIR}/pg17-source.dump"

stat --format '%n %s bytes' "${RUN_DIR}/pg17-source.dump"
sha256sum "${RUN_DIR}/pg17-source.dump" \
  > "${RUN_DIR}/pg17-source.dump.sha256"
du -sb db-data
```

`dump-db.ts` は custom format、TTY 無効、partial file からの atomic rename、
既存出力の上書き拒否を行う。終了 code、所要時間、bytes、SHA-256 を保存する。

### 2.3 空の PG18 volume へ restore

同名の rehearsal volume が残っている場合は使い回さない。削除は中身と対象名を
確認し、rehearsal の不要が承認された場合だけ行う。`down -v` は使用しない。

```bash
docker compose -f compose.pg18-rehearsal.yml up -d --wait db-pg18-rehearsal
docker compose -f compose.pg18-rehearsal.yml ps db-pg18-rehearsal
docker inspect --format '{{.Config.Image}}|{{.Image}}' \
  "$(docker compose -f compose.pg18-rehearsal.yml ps -q db-pg18-rehearsal)"
docker inspect --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}' \
  "$(docker compose -f compose.pg18-rehearsal.yml ps -q db-pg18-rehearsal)"

/usr/bin/time -v bun apps/server/scripts/restore-db.ts \
  --compose-file compose.pg18-rehearsal.yml \
  --service db-pg18-rehearsal \
  --input "${RUN_DIR}/pg17-source.dump" \
  --confirm-empty-target
docker compose -f compose.pg18-rehearsal.yml exec -T db-pg18-rehearsal \
  du -sb /var/lib/postgresql
```

restore は user table だけでなく enum、domain、function、sequence、view、Drizzle
schema もない target にしか実行できない。途中失敗した target は修復して再利用
せず、停止後に隔離 volume を破棄し、新しい空 volume で最初からやり直す。

### 2.4 migration、ANALYZE、完全一致検証

PG18 の公開 port は既定で `55432` である。`DB_USER`、`DB_PASSWORD`、
`DB_DATABASE` は compose と同じ値を、保護された実行環境から渡す。

```bash
DB_HOST=127.0.0.1 \
DB_PORT="${PG18_REHEARSAL_PORT:-55432}" \
bun run --cwd apps/server db:migrate

/usr/bin/time -v bun apps/server/scripts/validate-postgres-rehearsal.ts \
  --compose-file compose.pg18-rehearsal.yml \
  --service db-pg18-rehearsal \
  --expected-major 18 \
  --expected-vector-version 0.8.5 \
  --expected-report "${RUN_DIR}/pg17-source.json" \
  --output "${RUN_DIR}/pg18-target.json"
```

validator は `ANALYZE` の後、PostgreSQL major、pgvector version、source table の exact
row count、migration prefix（ID/hash）、source constraint
（name/type/definition/validated）、invalid constraint 0、rollback される read/write
probe、vector cosine probe を調べる。migration で target にだけ追加される既定
allowlist は `media_regions=0` と `ccip_embeddings=0` だけであり、それ以外の追加 table
または異なる件数は no-go になる。

```bash
jq -e '
  .ok == true and
  (.mismatches | length == 0) and
  (.tableCounts.media_regions == 0) and
  (.tableCounts.ccip_embeddings == 0) and
  (.invalidConstraintCount == 0)
' \
  "${RUN_DIR}/pg18-target.json"
```

target report の全 migration ID/hash と追加 constraint は、rehearsal 対象 commit の
Drizzle artifact と照合して記録する。既定二 table 以外を意図的に追加する release
では、review 済みの `--allow-added-table table_name=expected_count` を明示する。暗黙に
allowlist を広げない。

最後に production build の application を PG18 target へ向けて別 terminal で起動し、
SSR と DB query を通る `/sources` を確認する。`DB_USER`、`DB_PASSWORD`、
`DB_DATABASE` も rehearsal compose と同じ値を渡す。

```bash
bun run --cwd apps/server build

DB_HOST=127.0.0.1 \
DB_PORT="${PG18_REHEARSAL_PORT:-55432}" \
NITRO_HOST=127.0.0.1 \
NITRO_PORT=3100 \
bun run --cwd apps/server start
```

別 terminal から次を実行する。

```bash
curl --fail --show-error --silent http://127.0.0.1:3100/sources \
  > /dev/null
```

HTTP success だけでなく、application log に DB connection、migration、query、SSR の
error がないことを確認する。rehearsal では smoke 後に target を破棄する。本番の
最初の write 前チェックでは worker と writer を停止したまま、read-only smoke と
して実行する。

### 2.5 rehearsal の go/no-go

次がすべて満たされたときだけ go とする。

- dump/restore/migration/validation がすべて exit code 0。
- target は PG18、pgvector `0.8.5`、health check ready。
- source table/count と migration prefix/constraint が一致し、target-only table は
  review 済み allowlist の exact count、invalid constraint は 0。
- vector probe と rollback される read/write probe が成功。
- target の image tag と digest が記録済みで、本番用の pinned image と一致。
- dump/restore/validation の最大所要時間と必要容量が本番 window 内に収まる。
- application の read、代表的な write、job claim、CCIP search の smoke test が成功。
- JSON report、dump SHA-256、時刻、容量、所要時間、ログが保存済み。

一つでも不明・不一致・未記録なら no-go である。rehearsal target を本番へ昇格
させず、原因修正後に新しい run ID と空 volume で全手順を繰り返す。

## 3. `jobs` を WAL-logged table にする

この操作は Drizzle の通常 migration から分離されている。`ALTER TABLE ... SET
LOGGED` は table rewrite と lock を伴うため、承認済み maintenance window で行う。

### 3.1 quiesce と dry-run audit

1. 新規 job の受付を止める。
2. application server と全 worker instance を止める。
3. `in_progress` が 0 になるまで待つ。強制停止した job は lease recovery 方針を
   記録し、手作業で成功扱いにしない。
4. PostgreSQL 接続用の `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、
   `DB_DATABASE` を設定して audit を実行する。

```bash
date --iso-8601=seconds
docker compose -f compose.yml exec -T db \
  df -B1 /var/lib/postgresql/data
bun apps/server/scripts/set-jobs-logged.ts \
  > "${RUN_DIR}/jobs-set-logged-dry-run.json"
jq -e '
  .mode == "dry-run" and
  .ready == true and
  .before.inProgressJobs == 0 and
  .startedAt and .finishedAt and
  (.elapsedMs >= 0) and
  (.maxLockWaitMs == 5000) and
  (.before.tableBytes >= 0) and
  (.before.indexBytes >= 0) and
  (.before.totalBytes >= .before.tableBytes)
' \
  "${RUN_DIR}/jobs-set-logged-dry-run.json"
```

`missingQueueNames`、`orphanParents`、`duplicateActiveDedupeKeys`、
`duplicateRunningConcurrencyKeys`、`invalidRetryRows` もすべて 0 でなければ no-go。
行を場当たり的に削除せず、migration/backfill または生成側の原因を修正する。

### 3.2 SET LOGGED と commit 境界

```bash
/usr/bin/time -v bun apps/server/scripts/set-jobs-logged.ts \
  --apply \
  --confirm-jobs-quiesced \
  > "${RUN_DIR}/jobs-set-logged-apply.json"
jq -s -e '
  map(select(.mode == "apply")) as $reports |
  ($reports | length) == 1 and
  ($reports[0].after.relpersistence == "p") and
  ($reports[0].startedAt | type == "string") and
  ($reports[0].finishedAt | type == "string") and
  ($reports[0].elapsedMs >= 0) and
  ($reports[0].maxLockWaitMs == 5000) and
  (($reports[0].changed == false) or ($reports[0].rewriteElapsedMs >= 0)) and
  ($reports[0].after.tableBytes >= 0) and
  ($reports[0].after.indexBytes >= 0) and
  ($reports[0].after.totalBytes >= $reports[0].after.tableBytes)
' \
  "${RUN_DIR}/jobs-set-logged-apply.json"
docker compose -f compose.yml exec -T db \
  df -B1 /var/lib/postgresql/data
date --iso-8601=seconds
```

初回 rewrite では apply report の `changed=true` と `rewriteElapsedMs >= 0` も確認する。
すでに `relpersistence=p` なら apply を繰り返さず、dry-run と過去の apply 証跡を
紐付ける。

apply JSON の `startedAt`、`finishedAt`、`elapsedMs`、`rewriteElapsedMs`、
`maxLockWaitMs` と、before/after の `tableBytes`、`indexBytes`、`totalBytes` を保存する。
実行前後の volume free bytes とあわせて table rewrite の実容量・所要時間を記録し、
rehearsal で maintenance window と空き容量の上限を決める。

apply は transaction 内で advisory lock を取得し、`lock_timeout = 5s` を設定して
audit を再実行した後に rewrite する。lock timeout、audit 違反、SQL error の場合は
transaction が rollback されるので、worker を停止したまま原因を調べる。

commit 前が安全な rollback boundary である。commit 後に `SET UNLOGGED` へ戻す
ことを rollback として扱わない。`SET LOGGED` 自体は job の論理内容を変えないため、
commit 後の障害は table を permanent のまま保持して worker/startup 側を修正する。

### 3.3 restart claim test

1. 管理対象の idempotent な job を通常の API/UI から一件 enqueue する。SQL で
   payload を直接 insert しない。
2. worker を一 instance だけ起動する。
3. その job が `pending` → `in_progress` → terminal state へ一度だけ遷移し、
   `claim_token`、`claimed_by`、`heartbeat_at`、`attempt_count` が妥当なことを
   safe jobs API と構造化ログで確認する。
4. worker を再起動し、未完了 job の lease recovery 後に二重 side effect なしで
   claim/complete できることを確認する。
5. AI queue と default queue の双方で一件ずつ確認してから通常 concurrency と
   job 受付を戻す。

claim が重複する、heartbeat が更新されない、古い claim が完了を commit する、
同じ `concurrency_key` が同時実行される、parent progress が terminal child の実数と
一致しない場合は no-go。worker を再停止し、job を手動完了・削除しない。

## 4. CCIP LanceDB → PostgreSQL/pgvector

### 4.1 store mode と順序

`config.json`（または `CONFIG_PATH` の指すファイル）の
`lancedb.ccipStoreMode` は次の意味を持つ。変更後は server を再起動し、実際の設定と
read backend をログで確認する。

| mode | read | write | 用途 |
| --- | --- | --- | --- |
| `lance` | legacy Lance | legacy Lance | 移行前だけ |
| `lance-dual-write` | rollback Lance mirror | rollback mirror → PostgreSQL | initial backfill 後、read switch 前 |
| `postgres-dual-write` | PostgreSQL | PostgreSQL → rollback Lance mirror | read switch 後の観測期間 |
| `postgres` | PostgreSQL | PostgreSQL | 観測完了後 |
| `lance-readonly` | rollback Lance | 拒否 | write-freeze 中の緊急調査だけ |

dual-write は同期処理であり、secondary failure を成功として隠さない。部分成功は
`CcipDualWriteError` として記録される。再試行は key 単位で idempotent でなければ
ならない。

移行順序は必ず次の通りにする。

1. immutable legacy snapshot と manifest/fingerprint
2. dry-run
3. initial backfill と別 directory の rollback mirror 生成
4. `lance-dual-write`
5. final delta と全件 parity
6. `postgres-dual-write` へ read switch
7. 連続 7 日の observation
8. `postgres`

### 4.2 immutable snapshot

CCIP extraction と CCIP vector の create/update/delete を quiesce してから snapshot
を作る。`lancedb.ccipVectorDir` の live directory と、既存の source dump は変更
しない。snapshot、rollback mirror、checkpoint はそれぞれ別 directory にする。

以下は GNU coreutils を使う例である。snapshot は元 directory の子に作らない。

```bash
CCIP_LIVE_DIR="<config.json の lancedb.ccipVectorDir の絶対 path>"
CCIP_SNAPSHOT_DIR="<immutable snapshot の新規絶対 path>"
CCIP_ROLLBACK_DIR="<rollback mirror の新規絶対 path>"
install -d -m 0700 "${CCIP_SNAPSHOT_DIR}" "${CCIP_ROLLBACK_DIR}"

(
  cd "${CCIP_LIVE_DIR}"
  find . -type f -printf '%P\t%s\n' | sort
) > "${RUN_DIR}/ccip-live.files.tsv"
(
  cd "${CCIP_LIVE_DIR}"
  find . -type f -print0 | sort -z | xargs -0 -r sha256sum
) > "${RUN_DIR}/ccip-live.manifest.sha256"

cp -a --reflink=auto -- "${CCIP_LIVE_DIR}/." "${CCIP_SNAPSHOT_DIR}/"

(
  cd "${CCIP_SNAPSHOT_DIR}"
  find . -type f -printf '%P\t%s\n' | sort
) > "${RUN_DIR}/ccip-snapshot.files.tsv"
(
  cd "${CCIP_SNAPSHOT_DIR}"
  find . -type f -print0 | sort -z | xargs -0 -r sha256sum
) > "${RUN_DIR}/ccip-snapshot.manifest.sha256"

cmp "${RUN_DIR}/ccip-live.files.tsv" \
  "${RUN_DIR}/ccip-snapshot.files.tsv"
cmp "${RUN_DIR}/ccip-live.manifest.sha256" \
  "${RUN_DIR}/ccip-snapshot.manifest.sha256"
sha256sum "${RUN_DIR}/ccip-snapshot.files.tsv" \
  "${RUN_DIR}/ccip-snapshot.manifest.sha256" \
  > "${RUN_DIR}/ccip-snapshot.manifest-components.sha256"
sha256sum "${RUN_DIR}/ccip-snapshot.manifest-components.sha256" \
  > "${RUN_DIR}/ccip-snapshot.fingerprint.sha256"
chmod -R a-w "${CCIP_SNAPSHOT_DIR}"
du -sb "${CCIP_LIVE_DIR}" "${CCIP_SNAPSHOT_DIR}" "${CCIP_ROLLBACK_DIR}"
```

manifest には相対 path、file bytes、各 file の SHA-256 を辞書順で記録し、その
manifest 自体の SHA-256 を fingerprint とする。少なくとも次を保存する。

- source directory の canonical path と total bytes
- snapshot 開始/終了時刻と所要時間
- file count、manifest path、manifest fingerprint
- source application version、LanceDB library version、table/schema metadata
- model、embedding version、vector dimension、logical row count

snapshot 作成後に source と snapshot の manifest fingerprint を再計算し、完全一致
を確認する。snapshot を read-only にし、その後の migration は snapshot path を
source とする。dry-run または backfill 後に fingerprint が変化したら no-go。

### 4.3 dry-run、checkpoint、initial backfill

実行時点の正確な引数は script 自身を source of truth とし、最初に help を保存する。

```bash
bun run --cwd apps/server ccip:migrate-from-lancedb --help \
  > "${RUN_DIR}/ccip-migrate-help.txt"

/usr/bin/time -v bun run --cwd apps/server ccip:migrate-from-lancedb \
  --dry-run \
  --source-dir "${CCIP_SNAPSHOT_DIR}" \
  --batch-size 100 \
  --checkpoint "${RUN_DIR}/ccip-dry-run.checkpoint.json" \
  --report "${RUN_DIR}/ccip-dry-run.json" \
  --rollback-dir "${CCIP_ROLLBACK_DIR}"
```

dry-run は PostgreSQL、snapshot、live LanceDB、rollback mirror を変更してはならない。
manifest/fingerprint、logical key、metadata/revision、vector dimension と finite value、
参照先 media/region を検証する。次は warning や silent skip ではなく exit code 非 0
の no-go とする。

- 同じ `(regionId, model, embeddingVersion, preprocessingProfile)` に内容の異なる
  複数 record がある
- media/region の orphan、invalid UUID、invalid dimension、NaN/Infinity がある
- full region の source/input revision または preprocessing profile を導出できない
- snapshot manifest/fingerprint が変化した

initial backfill は deterministic key 順、固定 batch size で行う。checkpoint には
snapshot fingerprint、最後に commit 済みの key、件数、実行 version を atomic に
保存する。process crash 後は同じ fingerprint の checkpoint だけを resume できる。
異なる snapshot、code revision、schema で checkpoint を再利用しない。batch commit
前の key は再処理され得るため、upsert は idempotent でなければならない。

dry-run が go なら、同じ snapshot と rollback directory、および実 migration 専用の
checkpoint を指定して backfill する。dry-run の checkpoint を実 migration に再利用
しない。`--resume` は中断された実 migration の checkpoint が存在し fingerprint が
一致するときだけ付ける。

```bash
/usr/bin/time -v bun run --cwd apps/server ccip:migrate-from-lancedb \
  --source-dir "${CCIP_SNAPSHOT_DIR}" \
  --batch-size 100 \
  --checkpoint "${RUN_DIR}/ccip-initial.checkpoint.json" \
  --report "${RUN_DIR}/ccip-initial-backfill.json" \
  --rollback-dir "${CCIP_ROLLBACK_DIR}"
```

中断後の再開だけは、同じコマンドへ `--resume` を追加する。

`--source-id` を使う分割実行は rehearsal と原因調査には使えるが、本番 read switch
の判定は source filter なしの全件 report で行う。実行後、raw rows、unique logical
rows、collapsed identical duplicates、insert/update 件数を JSON report として保存する。

### 4.4 dual-write、final delta、全件 parity

initial backfill が成功したら `lance-dual-write` で server を再起動し、read が生成済み
rollback Lance mirror、全 mutation が rollback mirror と PostgreSQL の両方へ同期成功
することを確認して writer を再開する。legacy live/source dump を dual-write 先に
しない。その後 writer を短時間 quiesce し、rollback mirror を読み取り source として
同じ deterministic migration を full scan し、final delta を適用する。immutable
snapshot と legacy live/source dump はこの処理でも参照・変更しない。

```bash
/usr/bin/time -v bun run --cwd apps/server ccip:migrate-from-lancedb \
  --source-dir "${CCIP_ROLLBACK_DIR}" \
  --batch-size 100 \
  --checkpoint "${RUN_DIR}/ccip-final.checkpoint.json" \
  --report "${RUN_DIR}/ccip-final-delta.json" \
  --rollback-dir "${CCIP_ROLLBACK_DIR}"

bun run --cwd apps/server ccip:migrate-from-lancedb \
  --verify-only \
  --source-dir "${CCIP_ROLLBACK_DIR}" \
  --report "${RUN_DIR}/ccip-full-parity.json"
```

quiesce を維持したまま、source filter なしで次の全件 parity を取る。

- exact key set: `(regionId, model, embeddingVersion, preprocessingProfile)`
- exact metadata: media/source/region、region kind、input revision、preprocessing
  profile、dimension と schema version
- vector: dimension と finite value が一致し、対応 vector 間の cosine distance
  `<= 1e-6`
- search: 固定した anchor/query/filter/top-K 全件で tie group が一致する。同距離 tie
  内の順番だけは問わないが、tie group を跨ぐ欠落・追加は不一致とする
- Rust rerank: 同じ候補集合・同じ query で最終 tie group と score tolerance が一致
- orphan/conflict/invalid record が 0

parity は exit code 0、JSON の `ok=true`、mismatch 0 が必要である。sample parity だけで
read switch してはならない。report に snapshot fingerprint、checkpoint、両 backend
件数、query seed、top-K、tolerance、Rust/AI service version を含める。

### 4.5 read switch と 7 日 observation

全件 parity が成功した時刻を `T0` とし、`postgres-dual-write` へ変更して server を
再起動する。read が PostgreSQL、write が PostgreSQL → legacy Lance になったことを
確認して writer を再開する。

`T0` から連続 7 日、毎日同じ時刻帯に次を行う。

1. 管理対象の test media/region で CCIP record を create する。
2. source/input revision が変わる update/extract を行う。
3. record を delete する。
4. 各操作が両 backend で同じ terminal state になったことを確認する。
5. source filter なしの全件 parity と、固定 query suite の top-K/tie/Rust rerank
   parity を実行する。
6. dual-write partial failure、retry、lease recovery、search latency/error rate を確認する。

一件でも mismatch、未解決 partial write、parity 未実施日があれば時計を 0 日へ戻す。
原因修正と full parity 成功の時刻を新しい `T0` とし、そこから連続 7 日を取り直す。
7 日完了後、変更承認を得て `postgres` へ切り替える。

### 4.6 CCIP rollback

- read switch 前: writer を止め、`lance-dual-write` から `lance` へ戻す。
- observation 中: writer を止め、legacy mirror の full parity を確認できた場合だけ
  `lance-dual-write` へ戻す。PostgreSQL だけに成功した partial write がある場合は、
  先に差分を解消する。
- `lance-readonly` は rollback mirror の調査用で、mutation を拒否する。通常運転の
  rollback mode にしない。
- original source dump/snapshot は変更・削除せず、そこへ逆同期しない。rollback 用
  live/mirror は別 directory とする。

## 5. 本番 PG18 final cutover

この section 固有の rehearsal と承認、および jobs の restart claim test が完了して
から、別承認済みの window で行う。CCIP read cutover の 7 日 observation は独立した
gate であり、この PG18 cutover の前提にはしない。timed rehearsal の dump を再利用
しない。

### 5.1 write-freeze と fresh dump

1. API の mutation、新規 import、file watcher、scheduler、全 job worker、CCIP writer
   を停止する。PG17 DB は dump のため稼働させる。
2. `jobs.status='in_progress'` が 0、dual-write partial failure が 0、保留 transaction
   がないことを証跡化する。
3. freeze 直後の source report を作る。
4. fresh custom dump を作り、bytes/SHA-256/所要時間を記録する。
5. dump 後に source report をもう一度取り、table counts、migrations、constraints が
   freeze 直後と完全一致することを確認する。

```bash
bun apps/server/scripts/validate-postgres-rehearsal.ts \
  --compose-file compose.yml --service db --expected-major 17 \
  --expect-vector-unavailable \
  --output "${RUN_DIR}/final-pg17-before-dump.json"

/usr/bin/time -v bun apps/server/scripts/dump-db.ts \
  --compose-file compose.yml --service db \
  --output "${RUN_DIR}/final-pg17.dump"
stat --format '%n %s bytes' "${RUN_DIR}/final-pg17.dump"
sha256sum "${RUN_DIR}/final-pg17.dump" \
  > "${RUN_DIR}/final-pg17.dump.sha256"

bun apps/server/scripts/validate-postgres-rehearsal.ts \
  --compose-file compose.yml --service db --expected-major 17 \
  --expect-vector-unavailable \
  --output "${RUN_DIR}/final-pg17-after-dump.json"

jq -S '{tableCounts,migrations,constraints}' \
  "${RUN_DIR}/final-pg17-before-dump.json" \
  > "${RUN_DIR}/final-pg17-before-structure.json"
jq -S '{tableCounts,migrations,constraints}' \
  "${RUN_DIR}/final-pg17-after-dump.json" \
  > "${RUN_DIR}/final-pg17-after-structure.json"
diff -u "${RUN_DIR}/final-pg17-before-structure.json" \
  "${RUN_DIR}/final-pg17-after-structure.json"
```

差分があれば write-freeze は成立していないため no-go。dump を破棄扱いにし、writer
を特定して freeze からやり直す。

### 5.2 fresh PG18 target と go/no-go

本番 target は rehearsal volume ではなく、未使用の新規 volume を使う。承認済み
本番 compose には rehearsal と同じ pinned PG18 tag+digest、および PG18 用の
`/var/lib/postgresql` mount が必要である。現在の `compose.yml` はこの条件を満たす
本番 cutover 定義ではないため、別変更なしに image/volume を切り替えてはならない。

承認済み compose/service を `restore-db.ts` の `--compose-file`/`--service` へ明示し、
次の順を崩さない。

1. fresh volume の target を起動して health ready を確認。
2. `--confirm-empty-target` 付きで final custom dump を restore。
3. final code revision の `db:migrate` を target 接続情報で実行。
4. validator で `ANALYZE`、exact count/migration/constraint、PG18、pgvector、vector、
   rollback read/write probe を確認。
5. PG17 source と PG18 target の双方で、rehearsal と本番の image tag/digest が完全
   一致することを再確認。いずれかの image が変わったら timed rehearsal からやり直す。
6. application の `/sources` readiness、job/CCIP readiness、起動ログを確認。

すべて成功した時だけ go とする。production server の起動 plugin は job worker と
startup maintenance も開始するため、現実装の app startup を read-only probe と
みなしてはならない。application を初めて PG18 へ向けて起動する直前を、PG17 へ
無損失で戻せる最後の rollback boundary とする。起動時刻を「最初の PG18 write の
可能性がある時刻」として記録し、直後に `/sources` と構造化ログを確認する。

### 5.3 PostgreSQL rollback boundary

**最初の PG18 write より前**なら、application/worker を停止したまま接続先を
preserved PG17 へ戻せる。PG18 target は調査用に隔離し、再利用しない。

**最初の PG18 write より後**は、PG18 から PG17 への reverse sync を実装していない。
したがって PG17 へ単純に接続を戻すと、その時刻以降の write を失うため rollback
ではない。障害時は直ちに全 writer を停止し、PG18 を正として forward recovery
する。データ損失を伴う PG17 復帰は incident owner とデータ所有者の別承認がない
限り実行しない。

## 6. 保持と旧 volume の破棄条件

次のすべてを満たすまで、PG17 volume、final dump と SHA-256、legacy Lance source
dump/snapshot、CCIP rollback mirror、manifest/checkpoint/parity report を保持する。

- PG18 と pgvector のバックアップを取得し、別の空 target への restore test が成功。
- PostgreSQL/application/job/CCIP の監視期間が完了し、未解決 mismatch・partial write・
  retry storm・invalid constraint が 0。
- CCIP は PostgreSQL read で連続 7 日の observation を完了。
- retention と rollback boundary をデータ所有者が確認。
- 破棄対象の volume 名、mount、bytes、最終 backup、復旧手順を二者で照合。
- Issue/変更申請に破棄承認と時刻が記録済み。

破棄するときも `docker compose down -v`、glob、未展開の環境変数は使わない。
`docker volume inspect <exact-volume-name>` で対象を解決し、container から未使用である
ことを確認してから、exact name 一件だけを別承認で削除する。legacy Lance source
dump は PostgreSQL/PG18 volume の破棄と同時に削除せず、定めた archive retention
に従う。

## 7. 最終証跡 checklist

- [ ] 実データ cutover の別承認、担当者、window、連絡先
- [ ] commit SHA と PG17/PG18 の image tag+digest
- [ ] phase ごとの開始/終了、所要時間、容量
- [ ] fresh dump bytes、SHA-256、source before/after report
- [ ] PG18 exact counts/migrations/constraints、vector/readiness report
- [ ] `jobs` dry-run/apply audit と restart claim test
- [ ] immutable Lance manifest/fingerprint と unchanged 再検証
- [ ] dry-run、checkpoint/resume、initial/final migration report
- [ ] full key/meta/vector/top-K tie/Rust rerank parity
- [ ] CCIP 連続 7 日の日次 create/update/delete/parity 記録
- [ ] go/no-go と rollback boundary の署名、最初の PG18 write 時刻
- [ ] 旧 volume/dump の retention と破棄承認
