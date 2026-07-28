---
name: ui-components
description: Solid.js の画面・レイアウト・フォーム・操作部品を実装または変更する際に、Solid UI の公式レジストリから利用可能なコンポーネントを検索・選定・導入し、solid-imager の共有 UI として再利用する。ユーザーが Solid UI を明示していなくても、ボタン、入力、選択、ダイアログ、メニュー、カード、テーブル、通知、ナビゲーション等の UI 作業や packages/ui/src の変更では必ず使用する。
---

# UI Components (solid-ui) スキル

このプロジェクトでは [Solid UI](https://www.solid-ui.com/) を標準の UI 部品ソースとして使用する。UI を一から実装する前に、必ずローカルの共有部品と Solid UI の公式レジストリを確認する。

## 必須ワークフロー

1. `packages/ui/src/` を `rg` し、既存の共有部品で実現できるか確認する。
2. `bun .agents/skills/ui-components/scripts/list-components.ts [検索語...]` を実行し、公式レジストリの候補と依存関係を確認する。検索語を省略すると全件を表示する。
3. 候補の公式ドキュメント `https://www.solid-ui.com/docs/components/<component>` を確認し、API、アクセシビリティ、必要な構成を把握する。
4. 既存部品があれば再利用する。なければ Solid UI の部品を選び、必要なものだけ導入する。
5. プロジェクトの props、class、export、import 規約に合わせて統合し、型チェックと関連テストを実行する。

## 配置と実装ルール

- 共通化できる UI は `packages/ui/src/` を優先する。
- server/Tauri 固有のルーティング、API 呼び出し、画面状態を含む合成コンポーネントだけを `apps/*/src` に置く。
- ネイティブ要素を直接装飾して Solid UI 相当を再実装しない。公式部品が要件を満たさない場合だけ独自実装し、その理由を簡潔に記録する。
- Solid UI はコードをプロジェクトへコピーする方式なので、導入後のソースをこのリポジトリの規約に合わせて保守する。
- CLI 実行前に対象ディレクトリの `ui.config.json`、alias、CSS、既存ファイルを確認する。上書きフラグを無断で使わない。
- CLI が生成する import 先と実際の共有パッケージ構成が異なる場合は、生成結果を `packages/ui` の export 方式へ明示的に合わせる。

## CLI

公式 CLI の現行仕様を扱うため、コマンドや設定について回答・変更する際はリポジトリの Context7 ルールに従って最新ドキュメントを取得する。

```bash
# 対話形式で公式コンポーネント一覧を表示
bunx solidui-cli@latest add

# 指定したコンポーネントを追加
bunx solidui-cli@latest add button dialog

# 初期化が必要な場合のみ
bunx solidui-cli@latest init
```

一覧確認だけなら、非対話で依存関係も表示できる同梱スクリプトを優先する。`--json` で機械可読出力を得られる。

```bash
bun .agents/skills/ui-components/scripts/list-components.ts dialog menu
bun .agents/skills/ui-components/scripts/list-components.ts --json
```

ネットワーク取得に失敗した場合は、古い記憶から候補を断定せず、失敗を報告して公式サイトまたは CLI の対話一覧を使う。
