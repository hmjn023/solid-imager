---
name: ui-components
description: solid-ui (shadcn/ui port) のコンポーネント管理。UIコンポーネントの新規追加 ('solidui-cli add')、初期化、テーマ設定、またはボタンや入力フォームなどのUIパーツを 'apps/server/src/components/ui/' 配下に実装・修正する際に使用してください。
---

# UI Components (solid-ui) スキル

このプロジェクトでは、UIコンポーネントライブラリとして [solid-ui](https://www.solid-ui.com/) を使用しています。これは shadcn/ui の Solid.js へのポートです。

## Working Rules

コンポーネントの追加等は `apps/server` ディレクトリで行ってください。

- **初期化コマンド:**
  ```bash
  cd apps/server && bunx solidui-cli@latest init
  ```
- **コンポーネントの追加:**
  ```bash
  cd apps/server && bunx solidui-cli@latest add [component]
  ```
  コンポーネント名は shadcn/ui と同じです。

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| solid-ui初期化 | `cd apps/server && bunx solidui-cli@latest init` |
| コンポーネント追加 | `cd apps/server && bunx solidui-cli@latest add [component]` |
| コンポーネント一覧確認 | solid-ui.com で利用可能なコンポーネントを確認 |
