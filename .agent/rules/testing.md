---
trigger: model_decision
description: 単体テスト、統合テスト、E2Eテストの実行方法や、テストコードの実装方針について確認が必要な場合に参照してください。
---

### テスト

-   **ユニット/インテグレーションテストの実行:**
    ```bash
    bun run test
    ```
-   **E2Eテストの実行:**
    ```bash
    bun --filter @solid-imager/server test:e2e
    ```
