---
name: shared-ui-parity
description: "`apps/server` と `apps/tauri` の同一責務の機能を同期するための手順。どちらか片側の route、UI コンポーネント、API、バックエンド処理を変更し、もう片側への移植・追従・差分確認が必要なときに使用してください。"
---

# shared-ui-parity

`apps/server` と `apps/tauri` で同名・同責務の機能が乖離しすぎないようにするための skill。

## When to use

- `apps/tauri` の機能実装中に、同一責務の処理が `apps/server` に既に存在するとき
- `apps/server/src/routes` の変更を `apps/tauri/src/routes` に反映するとき
- `apps/tauri/src/routes` の仮実装を server 側に寄せ直すとき
- 両アプリで重複している UI を `packages/ui` または app 内共通 component に寄せるとき
- `apps/server` と `apps/tauri` の同一機能に対して、片側だけ API、ジョブ、metadata 抽出、検索条件、保存処理を変えるとき
- server 側に既存のドメイン処理や変換処理があり、tauri 側で同等機能を作るとき

## Workflow

1. 変更対象機能を特定する。
2. `apps/tauri` を触るときは、同一責務の機能が `apps/server` にないか先に確認する。
3. 対応する server / tauri の route、component、API、backend 処理を両方読む。
4. server 側に既存実装がある場合は、それを参照実装として扱う。
5. まず責務と挙動を揃える。
6. UI は route 直書きを減らし、再利用 component に寄せる。
7. backend は片側だけに保存処理、抽出処理、検索処理、ジョブ処理を増やさない。
8. mock 実装なら API 接続しやすい props shape に整える。
9. 片側だけに追加した項目、操作、タブ、フィルタ、ダイアログ、API フィールド、処理分岐がないか確認する。

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

## Review checklist

- 対応する route が server / tauri の両方に存在するか
- タブ、フィルタ、ダイアログ、一覧、詳細の責務が揃っているか
- props 名や state 名が過度に独自化していないか
- mock データ shape が実 API に寄せられているか
- `packages/ui` で置き換えられる独自 UI が残っていないか
- 対応する API、DB 更新、metadata 処理、ジョブ処理が server / tauri で過度に乖離していないか
- `packages/core` に寄せられる処理を app 内で重複実装していないか

## File map

- Server routes: `apps/server/src/routes/`
- Server components: `apps/server/src/components/`
- Server backend: `apps/server/src/application/`, `apps/server/src/infrastructure/`
- Tauri routes: `apps/tauri/src/routes/`
- Tauri components: `apps/tauri/src/components/`
- Tauri backend: `apps/tauri/src-tauri/src/backend/`, `apps/tauri/src-tauri/src/commands/`
- Shared domain: `packages/core/`
- Shared UI: `packages/ui/`
