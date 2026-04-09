---
name: shared-ui-parity
description: "`apps/server` と `apps/tauri` の UI 構成を同期するための手順。どちらか片側の route や UI コンポーネントを変更し、もう片側への移植・追従・差分確認が必要なときに使用してください。"
---

# shared-ui-parity

`apps/server` と `apps/tauri` で同名・同責務の画面が乖離しすぎないようにするための skill。

## When to use

- `apps/server/src/routes` の変更を `apps/tauri/src/routes` に反映するとき
- `apps/tauri/src/routes` の仮実装を server 側に寄せ直すとき
- 両アプリで重複している UI を `packages/ui` または app 内共通 component に寄せるとき

## Workflow

1. 変更対象 route を特定する。
2. 対応する server / tauri の route と component を両方読む。
3. 画面責務を揃える。
4. route 直書きの UI を減らし、再利用 component に寄せる。
5. mock 実装なら API 接続しやすい props shape に整える。
6. 片側だけに追加した項目、操作、タブ、フィルタ、ダイアログがないか確認する。

## Priority order

1. 画面遷移
2. 情報構造
3. 主要操作
4. コンポーネント粒度
5. 見た目の細部

見た目を先に合わせすぎない。まず責務と操作を揃える。

## Shared component rule

- 複数画面または両 app で再利用できる UI は `packages/ui` を先に検討する。
- app 固有ロジックを含む場合は各 app の `src/components` に置く。
- route ファイルに大型フォームや複雑なカードを残し続けない。

## Review checklist

- 対応する route が server / tauri の両方に存在するか
- タブ、フィルタ、ダイアログ、一覧、詳細の責務が揃っているか
- props 名や state 名が過度に独自化していないか
- mock データ shape が実 API に寄せられているか
- `packages/ui` で置き換えられる独自 UI が残っていないか

## File map

- Server routes: `apps/server/src/routes/`
- Server components: `apps/server/src/components/`
- Tauri routes: `apps/tauri/src/routes/`
- Tauri components: `apps/tauri/src/components/`
- Shared UI: `packages/ui/`
