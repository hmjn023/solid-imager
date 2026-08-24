# PostgreSQL 18 / UUIDv7 本番移行手順

本手順は、PostgreSQL 17 + `pgvector` から PostgreSQL 18 へ移行し、既存のUUIDv4をUUIDv7へ変換する際に使用する。

今回の移行では、メディアの `created_at` など既存の時刻情報を元にUUIDv7を生成する。メディアの `created_at` がUnix epochを未知値として使っている場合は `modified_at` をフォールバックにする。旧IDと新IDの対応は `uuidv7_migration_map` に保持され、ジョブ・検索履歴・プリセットなどのID参照を含むJSONBも移行対象となる。

## 事前確認

- 本番で使用するコミットを固定し、ローカルまたはステージングで同じdumpのリストアとmigrationを一度実施する。
- `pgvector/pgvector:pg18` が取得でき、`vector` extensionを利用できることを確認する。
- PostgreSQL 17のデータディレクトリは削除せず、移行完了まで保持する。
- 実際に使用しているComposeの `-f` オプション、`.env`、`compose.production.override.yml` を確認する。
- メディアソースのコンテナ内パスは変更しない。DBに保存されたパスとmount先が一致している必要がある。

## 移行手順

### 1. メンテナンス状態にする

新規登録、インポート、ジョブ実行が発生しないようにする。現行Composeではworkerは `app` プロセス内で起動するため、`app` を停止するとworkerも停止する。別Composeや外部systemdでworkerを起動している場合は、それも停止する。

```bash
docker compose stop app nginx
docker compose ps --all
```

`app`、`nginx`、workerなどの書き込み元が停止していることを確認してから、バックアップへ進む。

### 2. PostgreSQL 17のバックアップを取得する

DBが停止している必要はないが、アプリケーションの書き込みを止めてから取得する。

```bash
mkdir -p backup

docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > backup/solid-imager-pre-pg18.dump

docker compose exec -T db sh -c \
  'pg_dumpall -U "$POSTGRES_USER" --globals-only' \
  > backup/solid-imager-pre-pg18-globals.sql

pg_restore --list backup/solid-imager-pre-pg18.dump \
  > backup/solid-imager-pre-pg18.list
sha256sum backup/solid-imager-pre-pg18.dump

if [ -d .cache ]; then
  tar -C . -czf backup/solid-imager-pre-pg18-runtime.tar.gz .cache
fi
```

`pg_dump` のcustom formatを使用しているため、リストアには `pg_restore` を使用する。追加ロールがある場合はglobalsも復元する。

DB以外に、次のデータもバックアップする。

- `config.json` または `CONFIG_PATH` で指定された設定ファイル
- `.cache/job-transfers` と `.cache/tar-staging`
- `.cache/thumbnails`
- メディアソースの実体、および本番Composeで指定している外部mount

### 3. PostgreSQL 18用の新しいデータディレクトリを用意する

PostgreSQLのmajor version間ではデータディレクトリを直接共有できない。既存の `db-data/` をPG18にmountして起動してはいけない。

まずDBコンテナを停止し、停止を確認してから現在の `db-data/` を `db-data-pg17/` などへ温存する。新しい空ディレクトリをPG18に割り当てる。

```bash
docker compose stop db
docker compose ps --all
```

`db` が停止していることを確認してから、データディレクトリを移動する。

```yaml
# compose.yml（このPR適用後の既定値）
services:
  db:
    image: pgvector/pgvector:pg18
    volumes:
      - ./db-data-pg18:/var/lib/postgresql
```

PostgreSQL 18ではmount先も `/var/lib/postgresql` に変更されている。データ実体はコンテナ内の `/var/lib/postgresql/18/docker` に作成されるため、ホスト側では `db-data-pg18/18/docker/` がPG18のデータディレクトリになる。`docker compose down -v` や旧ディレクトリの削除は行わない。既存環境から移行する場合は、pull後にComposeが `db-data-pg18/` を `/var/lib/postgresql` にmountしていることを確認する。

### 4. PostgreSQL 18だけを起動する

```bash
docker compose up -d db
docker compose exec -T db sh -c \
  'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

新しいPG18コンテナで `vector` extensionが利用可能であることも確認する。

### 5. dumpをPG18へリストアする

新しいDBへglobalsを必要に応じて復元した後、データベースdumpを戻す。

```bash
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error' \
  < backup/solid-imager-pre-pg18.dump
```

空のDBへリストアするため、通常は `--clean` は不要。ロール名が旧環境と異なる場合は `--no-owner` などを指定し、アプリのDBユーザーが所有権を持つようにする。

### 6. migrationを適用する

dumpをリストアした後に、アプリケーションのmigrationを実行する。アプリ起動時には自動適用されないため、明示的に実行する。

```bash
docker compose run --rm app \
  bun --cwd apps/server run db:migrate
```

この処理で、UUIDv7のデフォルト、ID変換、外部キー、ジョブ／検索履歴／プリセットのJSONB参照が更新される。`uuidv7_migration_map` はパス整合処理と監査のため残す。

### 7. ファイルパスを整合させる

DB migration後、appとworkerを起動する前に実行する。

```bash
docker compose run --rm app \
  bun --cwd apps/server run db:reconcile-uuidv7-paths
```

ジョブ入力、ジョブ成果物、tar staging、サムネイルキャッシュに含まれる旧UUIDを新UUIDへ変更する。対象ファイルが見つからない場合はスキップし、移行先が既に存在する場合は上書きせずエラーにする。

### 8. アプリケーションを起動する

```bash
docker compose up -d app nginx
docker compose logs --tail=200 app
```

## 移行後の確認

DB側では、PG18、migration map、UUIDv7、時刻情報を確認する。

```bash
docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "SELECT version();" \
    -c "SELECT count(*) FROM uuidv7_migration_map;" \
    -c "SELECT count(*) FROM media WHERE substring(id::text, 15, 1) = '\''7'\'';" \
    -c "SELECT min(created_at), max(created_at) FROM media;"'
```

アプリケーションでは、少なくとも次を確認する。

- ログイン、メディア一覧、検索、詳細表示
- 既存メディアのサムネイル表示
- import／xtractor経由の登録
- ジョブのclaim、実行、成果物のダウンロード
- 検索履歴、プリセット、過去ジョブの詳細表示

## ロールバック

移行後の新PG18 DBをUUIDv4へ戻すSQLは用意しない。問題があればapp/nginxを停止し、別workerがあればそれも停止する。新UUIDパスへ変更済みのキャッシュを旧アプリケーションが参照する前に、移行前に取得したファイルツリーを復元する。

```bash
docker compose stop app nginx

# 別workerを運用している場合は、それも停止する。
# 現在の失敗環境のキャッシュを退避してから移行前snapshotを戻す。
if [ -d .cache ]; then
  mv .cache .cache-pg18-failed
fi
tar -C . -xzf backup/solid-imager-pre-pg18-runtime.tar.gz
```

その後、旧アプリケーションのコミット、`pgvector/pg17`、温存したPG17のデータディレクトリを使って復旧する。外部メディアmountや設定ファイルを変更していた場合は、それらも移行前のsnapshotへ戻してから旧アプリケーションを起動する。

新環境での動作確認が完了するまで、旧データディレクトリ、dump、メディア、キャッシュを削除しない。
