---
name: shared-ui-parity
description: "`apps/server` と `apps/tauri` の同一責務の機能を同期するための手順。どちらか片側の route、UI コンポーネント、API、バックエンド処理を変更し、もう片側への移植・追従・差分確認が必要なときに使用してください。"
---

# shared-ui-parity

`apps/server` と `apps/tauri` で同名・同責務の機能が乖離しすぎないようにするための skill。

## Source of truth

- parity の現状マップは `.indexion/wiki/server-tauri-parity.md` を参照する
- 上位ルールは repo root の `AGENTS.md` と `apps/server/AGENTS.md`, `apps/tauri/AGENTS.md` を優先する
- ルールや対応関係を更新したら、skill だけで閉じず wiki も同じタスク内で更新する

## When to use

- `apps/tauri` の機能実装中に、同一責務の処理が `apps/server` に既に存在するとき
- `apps/server/src/routes` の変更を `apps/tauri/src/routes` に反映するとき
- `apps/tauri/src/routes` の仮実装を server 側に寄せ直すとき
- 両アプリで重複している UI を `packages/ui` または app 内共通 component に寄せるとき
- `apps/server` と `apps/tauri` の同一機能に対して、片側だけ API、ジョブ、metadata 抽出、検索条件、保存処理を変えるとき
- server 側に既存のドメイン処理や変換処理があり、tauri 側で同等機能を作るとき

## Boundary

- この skill は「server / tauri の責務差分を見つけて揃える」ためのもの
- shared package へ実際に引き上げる判断と実装が主題になったら `.agents/skills/server-tauri-commonization/SKILL.md` を併用する
- parity の確認だけで、共通化余地の確認を省略してはならない

## Out of scope

- `index` / `about` など shell page の差分
- Tauri の remote source (`sftp` / `s3`)
- Tauri standalone で AI を完結させる実装
- ただし上記でも命名や責務が他の主機能へ波及する場合は影響確認を行う

## Workflow

1. 変更対象の責務を 1 行で定義する。
2. `apps/tauri` を触るときは、先に `apps/server` 側の同一責務の route / component / backend を探す。
3. `.indexion/wiki/server-tauri-parity.md` を開き、既知の対応関係と例外を確認する。
4. 対応する server / tauri の route、component、API、backend 処理を両方読む。
5. どちらを参照実装にするか決める。既存の安定実装があるならそれを優先する。
6. まず責務と挙動を揃える。見た目は後回しにする。
7. UI は route 直書きを減らし、`packages/ui` か app 内共通 component に寄せる。
8. ドメイン処理、schema、repository、service の重複は `packages/core` / `packages/db` / `packages/application` へ寄せられないか確認する。
9. backend は片側だけに保存処理、抽出処理、検索処理、ジョブ処理を増やさない。
10. mock 実装なら API 接続しやすい props shape に整える。
11. 片側だけに追加した項目、操作、タブ、フィルタ、ダイアログ、API フィールド、処理分岐がないか確認する。
12. parity の対応関係や例外を変えたら `.indexion/wiki/server-tauri-parity.md` を更新する。
13. その差分が `packages/ui` / `packages/application` / `packages/db` / `packages/core` のどこへ寄せられるかを明記する。

## Update triggers

- 対応する route / component / hook / repository / service の片側だけを追加・削除した
- `packages/ui` / `packages/application` / `packages/db` に共通化を入れた
- parity 例外を追加した、または解消した
- server / tauri のどちらかで命名、入出力、処理順、失敗時の扱いを変えた

## Priority order

1. ドメイン責務
2. 保存・取得・抽出などのバックエンド挙動
3. 画面遷移
4. 情報構造
5. 主要操作
6. コンポーネント粒度
7. 見た目の細部

見た目を先に合わせすぎない。まず責務と挙動を揃える。

## Shared component rule

- 複数画面または両 app で再利用できる UI は `packages/ui` を先に検討する。
- app 固有ロジックを含む場合は各 app の `src/components` に置く。
- route ファイルに大型フォームや複雑なカードを残し続けない。

## Shared backend rule

- 同一責務の機能を `apps/server` と `apps/tauri` の両方で触るときは、同じタスク内で両側の挙動を確認し、必要なら同時に実装する。
- `apps/tauri` 実装時に同一責務の機能が `apps/server` に存在するなら、まず server 側を読んでから着手する。
- server 側に既に安定した実装がある場合は、それを参照実装として扱い、tauri 側の命名、入力、出力、処理順、失敗時の扱いをできるだけ揃える。
- 片側だけ修正して完了扱いにしない。少なくとももう片側への影響、未対応理由、差分の意図を残す。
- 共通化できる処理は新規に二重実装しない。`packages/core` のドメイン処理、スキーマ、変換ルール、判定ロジックを優先して使い回す。
- server 側に既に安定した処理がある場合は、その責務を基準に tauri 側を寄せる。必要なら共通パッケージへ引き上げてから使う。
- Tauri 固有事情で完全共通化できない場合でも、入力、出力、命名、失敗時の扱いは server 側と揃える。

## Shared package rule

- schema と型の source of truth は `packages/core` を優先する。
- repository の共通化候補は `packages/db` に寄せる。
- application service と job payload / utility の共通化候補は `packages/application` に寄せる。
- app 側には adapter / wrapper / platform 固有 I/O だけを残す。

## Review checklist

- 対応する route が server / tauri の両方に存在するか
- 対応表 wiki の記述を更新すべき差分が出ていないか
- タブ、フィルタ、ダイアログ、一覧、詳細の責務が揃っているか
- props 名や state 名が過度に独自化していないか
- mock データ shape が実 API に寄せられているか
- `packages/ui` で置き換えられる独自 UI が残っていないか
- 対応する API、DB 更新、metadata 処理、ジョブ処理が server / tauri で過度に乖離していないか
- `packages/core` に寄せられる処理を app 内で重複実装していないか
- `packages/db` / `packages/application` に寄せられる処理を app 内で重複実装していないか
- parity 例外なら、その理由が明文化されているか

## Strict completion gate

- route 名が揃っているだけでは完了にしない。loader、event 購読、主要操作、失敗時の扱いまで揃って初めて parity 達成とみなす
- shared component を import していても、route 側に重い状態管理や action 差分が残るなら完了にしない
- hook / service / repository の public I/F が一致していなければ完了にしない
- app 固有事情で差分を残す場合でも、差分が platform 固有 I/O に閉じていなければ完了にしない
- wiki では `完了` より `部分完了` をデフォルトにし、shared package と adapter の切り分けが説明できる場合だけ `完了` とする

## File map

- Server routes: `apps/server/src/routes/`
- Server components: `apps/server/src/components/`
- Server backend: `apps/server/src/application/`, `apps/server/src/infrastructure/`
- Tauri routes: `apps/tauri/src/routes/`
- Tauri components: `apps/tauri/src/components/`
- Tauri backend: `apps/tauri/src-tauri/src/backend/`, `apps/tauri/src-tauri/src/commands/`
- Shared domain: `packages/core/`
- Shared application: `packages/application/`
- Shared repositories / backup: `packages/db/`
- Shared UI: `packages/ui/`
