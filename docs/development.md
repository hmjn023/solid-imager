# 開発環境と管理スクリプト

構成・共通規約・検証コマンドは [AGENTS.md](../AGENTS.md) を参照する。

## セットアップ

リポジトリルートで依存をインストールし、初回はサーバー環境変数を設定する。

```bash
bun install
cp apps/server/.env.example apps/server/.env
```

既存の `.env` がある場合は上書きせず、exampleとの差分を確認する。
テンプレートの既定はPGlite。PostgreSQLを使う場合は `apps/server/.env` の `DB_HOST=localhost` と接続情報を設定し、Composeにも同じファイルを渡す。

```bash
docker compose --env-file apps/server/.env --project-directory . up -d
bun --filter @solid-imager/server run db:migrate
```

PGliteを使う場合のマイグレーションは以下。保存先は `PGLITE_DATA_DIR`、未指定なら `apps/server/.data/pglite`。schemaやrepositoryの変更は `database-schema` を参照する。

```bash
bun --filter @solid-imager/server run db:migrate:pglite
```

## サーバー管理スクリプト

配置先は `apps/server/scripts/`。所属パッケージをcwdにしてBunで実行する。

```bash
cd apps/server
bun scripts/your-script.ts
```

サービスレジストリに依存するスクリプトは、利用前に初期化する。

```typescript
import { initServices } from "../src/infrastructure/bootstrap";

initServices();
```

`initServices` はサービスと設定の登録用で、DB migration完了やworker起動までを保証する入口ではない。処理に必要なbootstrap順序は既存の同種スクリプトに合わせる。サービスを使わない単独スクリプトへ不要な初期化を追加しない。

## パスエイリアスの解決

`~/*` が解決できない場合は、まずcwdと `apps/server/tsconfig.json`、ルート設定との継承を確認する。serverでは `~/*` は `./src/*`、`scripts/**/*.ts` はinclude対象。

スクリプト実行のためだけに `baseUrl` を追加せず、実際の解決エラーを確認する。パッケージをまたぐimportには各workspaceの公開exportsを使う。
