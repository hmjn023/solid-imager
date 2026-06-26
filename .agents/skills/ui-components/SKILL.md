---
name: ui-components
description: solid-ui (shadcn/ui port) と共有UIの管理。ボタン、入力、ダイアログ等のUI部品、'packages/ui/src/'、またはアプリ固有UIの実装・修正時に使用する。
---

# UI Components (solid-ui) スキル

このプロジェクトでは、UIコンポーネントライブラリとして [solid-ui](https://www.solid-ui.com/) を使用しています。これは shadcn/ui の Solid.js へのポートです。

## Working Rules

共通化できるUIは `packages/ui/src/` を優先します。server/Tauri 固有のルーティングやAPI呼び出しを含む場合だけ、各 `apps/*/src` 側に置きます。

solid-ui CLI を使う場合は、追加先の app/package の既存構成を確認してから実行します。

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
| solid-ui初期化 | 追加先を確認して `solidui-cli init` |
| コンポーネント追加 | 共有なら `packages/ui/src/`、固有なら該当 app 側へ追加 |
| コンポーネント一覧確認 | solid-ui.com で利用可能なコンポーネントを確認 |
