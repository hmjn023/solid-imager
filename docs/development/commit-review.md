# Commit前のLLMレビュー

Huskyのpre-commitは整形・型チェック・テストの後、staged内容についてCodexで次の判断を行う。

- 現在のアーキテクチャ説明の更新が必要か。必要な更新が含まれているか。
- HTTP MCP / WebMCPの追加・更新が必要か。既存ツール、自動カタログ生成、画面連携で今回の操作をカバーできるか。

判断基準は [`tools/commit-review-policy.md`](../../tools/commit-review-policy.md) に集約する。チェックを増やす場合はrunnerとJSON schemaの項目も合わせて更新する。

## セットアップ

Bunと、`codex exec --ephemeral --output-schema` に対応したCodex CLIが必要。Codex CLIをインストール済みの開発環境で実行する。

```bash
bun install
codex login
```

`bun install` のprepare scriptが既存のHusky hookを有効にする。Codexの認証方式・モデル設定は開発者のCLI設定を利用する。

## 使い方

```bash
git add <変更したファイル>
bun run commit:review
git commit -m '...'
```

通常は `git commit` が自動実行するので、手動レビューは省略できる。手動でPASSになっていても、commit時には再レビューする。以前の結果を使ったスキップは行わない。

差分から分からない目的・要件があれば、commit時にも渡す。

```bash
COMMIT_REVIEW_CONTEXT='ジョブ登録後にJobs画面を開けることも要件に含む' git commit -m '...'
```

`COMMIT_REVIEW_MODEL` でモデル、`COMMIT_REVIEW_TIMEOUT_SECONDS` で制限時間を指定できる。制限時間は既定300秒、最大3600秒。

## 通過条件

両項目が理由・参照ファイル付きの `PASS` の場合だけ通過する。`NEEDS_CHANGE` は修正内容、`UNKNOWN` は追加で必要な情報を表示する。対応後に修正をstageし、再度commitする。

LLMの起動・認証失敗、タイムアウト、不正なJSON、根拠や判定項目の欠落、存在しない参照ファイル、判定と修正指示の矛盾でも停止する。

直近の有効な応答はGit管理ディレクトリの `commit-review/last-result.json` に保存する。`accepted` が通過結果を示す。実行開始時に古い結果を削除し、結果を通過証明として再利用しない。

```bash
cat "$(git rev-parse --git-path commit-review/last-result.json)"
bun run test:commit-review
```

## レビュー対象と制約

- 現在のGit indexからスナップショットを作る。未stageの修正、未追跡ファイル、ローカルの `.env`、`node_modules` をレビュー材料に混ぜない。新しい判断基準・schemaもstageしてから実行する。
- 変更前後の差分と、変更後の全追跡ファイルをレビューに使用できる。レビューはread-onlyの独立セッションで行い、プロジェクトのコード実行、ネットワーク・MCP利用、修正、commit、委任を指示しない。
- symlinkはリンク先の文字列として展開し、スナップショット外のファイルを読ませない。submoduleの中身はindexだけでは確認できないため停止する。
- レビュー終了時にHEADとindexのtreeを照合する。途中で変わった場合は、以前の差分のPASSでは通過しない。空の差分はLLMを呼ばず終了する。
- ソースをCodexの設定済みモデルに送信する。LLMの判断には誤りがあり得る。ローカルhookは `--no-verify` / `HUSKY=0` で回避可能なため、組織全体での強制が必要ならCIとブランチ保護も別途設定する。
