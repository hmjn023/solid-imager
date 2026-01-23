---
trigger: always_on
description: コード品質チェックの手順
---

### コード品質

コミットする前には、必ず **Biome** を使ってコードの品質をチェックしてください。

-   **チェックと修正の実行:**
    ```bash
    bun run check
    ```
-   **フォーマットのみの実行:**
    ```bash
    bun run format
    ```