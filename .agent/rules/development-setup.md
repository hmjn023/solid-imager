---
trigger: model_decision
description: 開発環境のセットアップ、依存関係のインストール、データベースの初期化手順についてユーザーが質問した際や、環境構築が必要な場合に参照してください。
---

### 開発セットアップ

すべてのコマンドは `bun` を使用して実行します。

1.  **依存関係のインストール:**
    ```bash
    bun install
    ```

2.  **環境変数の設定:**
    `.env.example` をコピーして `.env` を作成し、データベース接続情報などを設定してください。
    ```bash
    cp .env.example .env
    ```

3.  **データベースのセットアップ:**
    使用するデータベースに応じて、マイグレーションを実行します。
    -   **PostgreSQL (Docker):**
        ```bash
        sudo -E docker compose --project-directory . up -d
        bun run db:migrate
        ```
    -   **PGlite:**
        ```bash
        # .env で DB_HOST=pglite を設定
        bun run db:migrate:pglite
        ```