# 開発環境と管理スクリプト

構成・共通規約・検証コマンドは [AGENTS.md](../AGENTS.md) を参照する。

## セットアップ

リポジトリルートで依存をインストールし、初回はサーバー環境変数を設定する。

```bash
bun install
cp apps/server/.env.example apps/server/.env
```

既存の `.env` がある場合は上書きせず、exampleとの差分を確認する。
テンプレートの既定は PGlite です。保存先は `PGLITE_DATA_DIR` で指定でき、未指定なら `apps/server/.data/pglite` です。PostgreSQL は [mise Daemons](#mise-でサービスを起動) または Compose で起動できます。Compose を使う場合は `apps/server/.env` の `DB_HOST=127.0.0.1` と接続情報を設定し、Compose にも同じファイルを渡します。

```bash
docker compose --env-file apps/server/.env --project-directory . up -d
```

PGlite と PostgreSQL のどちらも、同じコマンドでマイグレーションを適用します。

```bash
bun run --cwd apps/server db:migrate
```

Drizzle 0.x から更新する既存環境では、DBをバックアップしてから `db:migrate` を実行する。初回実行時にDrizzleが適用履歴をv1形式に更新し、未適用のマイグレーションを実行する。リポジトリの履歴は `bun run --cwd apps/server db:check` で検証できる。schemaやrepositoryの変更は `database-schema` を参照する。

## mise でサービスを起動

Linux で mise 2026.11.10 以降、Docker または Podman、`curl` を用意します。ルートの `.env` に `DB_HOST=127.0.0.1`、`POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD` を設定します。作成済みの DB には初期化時の認証情報を指定します。従来の `DB_DATABASE`、`DB_USER`、`DB_PASSWORD` を使っていた場合は、mise の PostgreSQL 用に同じ値を `POSTGRES_*` に移します。初回とアプリのコード変更後は、リポジトリルートでサーバーをビルドします。

```bash
bun run --cwd apps/server build
```

```bash
mise daemons start nginx
mise daemons status
mise daemons logs --follow
mise daemons stop
```

`start nginx` は PostgreSQL 18 + pgvector を起動し、DB マイグレーションを適用してから `bun run start` でアプリを起動します。アプリの `/api/health` と nginx のワーカー起動を順に確認します。初回起動時に mise が Pitchfork をインストールします。

ポートを省略すると PostgreSQL は `5432`、Bun は `3000`、nginx は HTTP `80` と HTTPS `443` を使います。上書きする場合は `.env` の `PGPORT`、`NITRO_PORT`、`NGINX_PORT`、`NGINX_TLS_PORT` を設定します。80 番へのバインド権限がない場合は `NGINX_PORT=8080` などを指定してください。mise の PostgreSQL は [専用の認証設定](../tools/mise/pg_hba.conf) を使い、既存のデータディレクトリでも TCP 接続に SCRAM パスワード認証を要求します。

mise で `NGINX_CONFIG` を省略すると `nginx.conf.example` のループバック HTTP 設定を使います。公開用や Compose 用には `nginx.conf.example` を `nginx.conf` にコピーし、接続先・待ち受け・TLS の該当箇所を切り替えます。mise でコピーを使う場合は `.env` に `NGINX_CONFIG=./nginx.conf` を設定します。相対パスはリポジトリルートが基準です。指定ファイルはコンテナに読み取り専用で渡し、起動時にポート変数を展開します。

nginx の設定ファイルだけを差し替える場合は `mise daemons stop nginx` に続けて `mise daemons start nginx` を実行します。TLS では `~/.config/letsencrypt` をコンテナの `/etc/letsencrypt` から参照できます。公開先に合わせて `.env` の `REST_PUBLIC_ORIGIN` や `MCP_ALLOWED_HOSTS` を設定します。mise の DB データは `.data/mise-postgres` に保存します。Compose から切り替える場合は既存 DB を論理ダンプから復元します。

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


## 文言と表示言語

固定のUI文言は `packages/i18n/src/en.ts` と `ja.ts` に同じキーで定義し、
`@solid-imager/i18n` の `t` を使います。日本語が既定です。Web・Tauriは
設定 → 画面表示から切り替えます。拡張機能はポップアップで選択します。

```tsx
import { t } from "@solid-imager/i18n";

<Button>{t("actions.save")}</Button>
```

保存・削除・キャンセルなどは `actions.*`、主要ナビゲーションは `navigation.*`
を共有します。新しい文には意味の分かるキーと `{count}` などの引数名を付け、
文全体を辞書に登録します。語順が言語で変わるため、翻訳した断片の連結は避けます。
キーの誤記、翻訳の不足、余分なキー、空の翻訳、引数名の不一致は型チェックで検出します。
不足時に原文や別言語で隠すフォールバックはありません。

`bun run lint:ui-text` はOxlintの独自ルールで、JSX本文・表示用属性・ラベル定義・
通知・フォーム検証・DOMへの文言設定と、ローカル定数やヘルパーを経由する直書きを検査します。
通常のlint、`bun run check`、コミット時のチェックにも接続しています。
辞書の用語・重複・埋め込み引数と検査ルールの回帰ケースは `bun run test` に含まれます。

ファイル名、タグ、作者名、ユーザー入力、サーバーから返された詳細、API識別子は翻訳しません。
テスト・生成コード・Design Labの静的プロトタイプは製品文言の検査対象外です。
独自の表示用propや通知APIを増やすときは `tools/ui-text.mjs` と対応するテストへ
表示先を追加してください。全ファイル・ディレクトリ単位で検査を無効化せず、
必要な例外は最小の箇所に理由を残します。

言語は端末の設定として保存し、切り替え時に再読み込みします。Web・Tauriは
`localStorage`、拡張機能はサービスワーカーとコンテンツスクリプトでも共有できる
`chrome.storage.local` を使います。拡張機能を挿入済みの外部ページは再読み込み後に
新しい言語になります。外部サイトの `lang` 属性や保存データは変更しません。
WebのSSRでは `solid-imager.locale` Cookieをリクエスト単位で読み取り、本文と
`<html lang>` の言語を揃えます。ブラウザーは初回HTMLの言語でhydrationを行います。
`localStorage` だけに保存された既存設定は初回表示後にCookieへ移行します。
サーバー処理で言語を明示する場合は `createTranslator(locale)` を使います。
フォームの標準検証メッセージと動画コントロールも表示言語に合わせます。
外部UIの翻訳は、部品の初期化前にブラウザー内で登録します。
