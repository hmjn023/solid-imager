---
trigger: glob
description: solid-ui (shadcn/ui port) コンポーネントの追加方法や使用方法に関するルール。UIコンポーネントを新規作成または変更する際に参照してください。
globs: apps/server/src/components/**/*.{tsx,jsx}
---

### UIコンポーネント (solid-ui)

このプロジェクトでは、UIコンポーネントライブラリとして [solid-ui](https://www.solid-ui.com/) を使用しています。これは shadcn/ui の Solid.js へのポートです。

コンポーネントの追加等は `apps/server` ディレクトリで行ってください。

-   **初期化コマンド:**
    ```bash
    cd apps/server && bunx solidui-cli@latest init
    ```
-   **コンポーネントの追加:**
    ```bash
    cd apps/server && bunx solidui-cli@latest add [component]
    ```
    コンポーネント名は shadcn/ui と同じです。
