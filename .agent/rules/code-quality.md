---
trigger: always_on
description: コード品質チェックの手順
---

### コード品質

コミットする前には、必ず **Biome** を使ってコードの品質をチェックしてください。

-   **ルートでのチェック:**
    ```bash
    bun run lint
    ```
-   **サーバー側でのチェック (型チェック含む):**
    ```bash
    bun --filter @solid-imager/server check
    ```
-   **フォーマットのみの実行:**
    ```bash
    bun run format
    ```
