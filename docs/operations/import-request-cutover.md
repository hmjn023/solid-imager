# Import request の移行・復旧

対象は [#788](https://github.com/hmjn023/solid-imager/issues/788)、親は [#621](https://github.com/hmjn023/solid-imager/issues/621)。承認待ち import を `jobs` から `import_requests` へ移す。download は既存 `downloadImage` queue/worker を使い、承認と予約を同じ transaction で保存する。download 完了後の source URL 保存、metadata/thumbnail と AI の独立した処理は維持する。

## 切替前

1. 旧・新サーバー、ブラウザ拡張、CLI など import writer の受付を停止する。旧サーバーで処理中の承認・取消・受付を完了させ、全 instance を停止する。旧承認は download 予約後に状態を更新するため、**処理中の旧承認を drain せずに切り替えてはいけない**。
2. DB の復旧可能な snapshot を取得する。認証 cookie を含む private snapshot は公開しない。
3. 旧 `jobs WHERE type = 'import_request'` の ID・status・入力を private な照合資料として保存する。type 別件数と承認済み download 予約も確認する。
4. 新コードの migration `0038_outgoing_slyde.sql` を通常の DB migration 手順で適用する。既存のユーザー DB にテスト用の接続設定を使わない。

## 切替

`apps/server` で接続先を明示して実行する。以下は mode の例であり、DB 環境変数は対象環境に合わせる。

```sh
bun scripts/import-request-cutover.ts inspect
bun scripts/import-request-cutover.ts activate --writers-stopped
bun scripts/import-request-cutover.ts inspect
```

この command は worker や ServiceRegistry を起動しない。PostgreSQL は `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`（または `DB_NAME`）、PGlite は `DB_HOST=pglite`, `PGLITE_DATA_DIR` を使う。`inspect` は件数と authority のみを読み、payload は出力しない。

migration 直後は `import_request_cutovers` が `authority=legacy, generation=0`。初回 `activate`、または初回 Imports API アクセスで次を一つの transaction に保存する。新サーバーの公開前に `activate` する運用を推奨する。

- control 行と旧 jobs table を lock し、250 行ずつ検証して旧 ID・入力・作成日時を保存する。
- `completed` は `approved`、`cancelled` は `cancelled`、旧 failure は `blocked`、有効な pending/in_progress は `pending` に対応する。
- 同じ入力の pending は canonical 要求と `superseded` alias にまとめる。旧 alias ID の承認・取消も canonical ID に解決する。
- 不正入力は `invalid_item` として隔離する。要求作成以後に同じ target URL の download 予約があれば `legacy_reservation` として隔離し、推測で再投入しない。
- 元の全行を private `import_request_legacy_snapshots` に保持し、旧 import 行を削除する。その他の job は変更しない。
- `authority=dedicated, generation=1` とし、trigger が旧 import 行の INSERT/UPDATE/DELETE を拒否する。

途中 failure は全変更を rollback する。再実行は dedicated なら変更しない。各新 API transaction は control 行の share lock を保持し、rollback と承認が同時に進まない。gate は drain の代替ではない。

## 照合・受付再開

旧 import 件数と `migrated`、snapshot 数、移行後の全状態件数を照合する。pending は旧 pending/in_progress から invalid・曖昧な予約・重複 alias を除いた件数になる。元 ID、入力、既存 download 予約と logical status を private な資料で照合し、移行中に予約が増えていないことも確認する。

`blocked` は inbox に出さず保存する。現在の UI に隔離要求の修復操作はないため、operator が private snapshot と download 実績を確認し、別途レビューした修復で扱う。`legacy_reservation` を一括 pending 化しない。

照合後に新サーバーだけを起動し、ブラウザを再読み込みして writer の受付を再開する。Web/Tauri は既存 Imports API と import event を使う。SSE は再取得のきっかけであり、状態の正本は DB の pending 一覧・件数。cookie/userAgent は一覧 DTO に返さない。

初期運用は single server instance に限定する。複数 server instance のリアルタイム通知を要件に含める場合は、jobs 削除前に transactional outbox または durable cross-process pub/sub を別 issue で導入する。

## Rollback

1. 新・旧 import writer を停止し、処理中 API を drain する。DB snapshot を取得する。
2. `bun scripts/import-request-cutover.ts rollback --writers-stopped` を実行する。
3. `inspect` と private な照合資料で復元件数を確認し、互換性のある旧サーバーのみを再開する。ブラウザも再読み込みする。

rollback は private snapshot の全旧列を復元し、現在の logical outcome を投影する。native 新要求も旧 import 行として復元する。approved は completed のまま、cancelled は cancelled、blocked は failed、alias は canonical の状態になる。既存 download 予約は削除せず、承認済み要求を pending に戻さない。ID 衝突は既存行を上書きせず、全 rollback を中断する。

authority を legacy に戻して generation を増やす。**generation が 0 でない legacy 状態では、新 API/activate の自動再切替は拒否する**。再度 dedicated に進むには、復旧 snapshot からの再開か、復元後の変更を照合する別の migration を計画する。generation を手で 0 に戻して再実行しない。

## 残りの段階

download 専用 run は #789、固定 batch は #790、source sync/export/restore は #791。全 reader/producer の参照ゼロ監査・観測期間・jobs 削除は #792。この PR は本番移行の実行や観測期間の完了を意味しない。
