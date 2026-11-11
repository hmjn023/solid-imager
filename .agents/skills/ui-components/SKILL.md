---
name: ui-components
description: Solid.jsの画面・部品・packages/ui/srcの変更時に必ず使用する。既存共有UIとSolid UI公式レジストリから部品を選び、統合する。
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
