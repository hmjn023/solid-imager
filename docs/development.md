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

## Modern Web Guidance

[GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) の公式CLI 1.0.0以降と公式スキルを使用する。スキル本体は共通スキルディレクトリで管理し、このリポジトリでは `skills-lock.json` の取得元・ハッシュを追跡する。

初回導入は公式ウィザードで利用するエージェントとグローバルへのインストールを選択する。この方法で導入したスキルは `update` で更新できる。他の方法で導入済みの場合は、そのインストール方法で更新する。

```bash
npx -y modern-web-guidance@latest install
npx -y modern-web-guidance@latest update
```

`skills-lock.json` の更新には、リポジトリルートで以下を実行する。生成された外部スキル本体はコミットせず、lockfileの差分を確認して反映する。

```bash
npx -y skills@latest add GoogleChrome/modern-web-guidance --skill modern-web-guidance --agent codex --yes --copy
```

Web実装では `search` → `retrieve` → 適用内容・フォールバックの確認を行う。`legacy-scan` はコードベース全体の近代化を依頼された場合に使う。Origin Trial・volatile featureのガイドは既定の制限に従い、必要性を確認してから明示的に有効化する。

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
