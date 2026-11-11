# imager-cli

Solid Imagerを管理するBun製CLI。incurでコマンドを定義し、サーバー通信には共有oRPC clientを使う。`db` はローカル／Dockerの `pg_dump`・`psql` を使う管理コマンド。

## 実行・ビルド

リポジトリルートから実行する。

```bash
bun run --filter @solid-imager/cli dev --help
bun run --cwd apps/cli build
```

ビルド結果は `apps/cli/dist/imager-cli`。コマンド・オプションの現行一覧は `--help` と各サブコマンドのhelpで確認する。

## コマンドの開発

- 定義は `src/commands/`。既存の引数定義と `src/index.ts` の登録方法に合わせる。
- API通信は共有clientとCore contractの公開入口を使う。schema・contract・公開DTOを変更する場合は `orpc-api` skillを参照する。
- DBやserverの実装を直接importしない。`job list/retry/clear` はCLIのAPI接続が未実装で、サーバーを呼ばず `NOT_IMPLEMENTED` を返す。
- 変更したコマンドのhelp、正常系・エラー時の出力を確認し、関連テストと型チェックを行う。

```bash
bun run --cwd apps/cli typecheck
bun run --cwd apps/cli test
```
