---
name: ui-components
description: Solid.jsの画面・部品・packages/ui/srcの変更時に必ず使用する。共有UI・Solid UIから部品を選び、実装後とUIを含むPRのレビュー時に差分を監査する。
---

# UI Components

## 選定・導入

1. `packages/ui/src/` の既存部品を検索する。
2. 同梱スクリプトで [Solid UI](https://www.solid-ui.com/) 公式レジストリの候補・依存を確認する。
3. `https://www.solid-ui.com/docs/components/<component>` でAPI・アクセシビリティ・構成を確認し、既存部品を再利用、または必要な公式部品を導入する。
4. props・class・公開exports・importを共有UIの規約へ合わせ、型チェックと関連テストを行う。

```bash
bun .agents/skills/ui-components/scripts/list-components.ts dialog menu
# 引数なしは全件、--jsonは機械可読出力
bunx solidui-cli@latest add button dialog
```

- 共通UIは `packages/ui/src/`、app固有のrouting・API・画面状態を含む合成部品は `apps/*/src` に置く。
- 公式部品が要件を満たす場合は、ネイティブ要素で同等部品を再実装しない。独自実装する理由は記録する。
- CLI前に `ui.config.json`・alias・CSS・既存ファイルを確認し、無断で上書きしない。`init` は初期化が必要な場合のみ。コピーしたコードは共有packageのexport方式へ合わせて保守する。
- CLI仕様はContext7で確認する。レジストリ取得に失敗したら報告し、公式サイトか `bunx solidui-cli@latest add` の対話一覧で確認する。

## 実装後・PRレビュー時の差分監査

実装後は今回の変更（新規ファイルとステージ済みの変更を含む）、PRレビュー時はベースブランチとの分岐点からPR先端までの差分を読む。対象は追加・変更したUIで、共有部品の内部に書いたJSXも含める。

1. 利用者の操作ごとに、同じ用途の部品を `packages/ui/src/` で探す。共有部品が見つからなければ、上の選定手順で公式候補を確認する。たとえば削除の確定には `AlertDialog`、候補からの単一選択には表示方法に応じて `Select` や `RadioGroup` を検討する。
2. 候補のpropsと既存の使用例を読み、必要な挙動を保てるか確かめる。たとえばタグを `Badge` で表示していても、タグ名で検索する操作には共有の `Button` が使えるかを別に見る。ネイティブ要素の出現だけを根拠に指摘しない。
3. 同等の部品があれば、実装時は置き換えて関連テストを確認する。レビュー時は該当行・代替部品・保てる挙動を示す。独自実装を残す場合は比較した候補と必要な挙動を一行で記録する。指摘も例外もなければ「UI差分確認済み」で終える。

同じ見逃しが繰り返され、違反と正当な利用を機械的に区別できる場合に限り、そのパターンのlint化を提案する。
