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
WebのHTMLはSSR時の日本語を維持し、hydration後に文書の言語を同期してから
既存のクライアントワークスペースを表示します。サーバー処理で明示的な翻訳が
必要な場合は、グローバル状態を変更せず `createTranslator(locale)` を使います。
フォームの標準検証メッセージと動画コントロールも表示言語に合わせます。
外部UIの翻訳は、部品の初期化前にブラウザー内で登録します。
