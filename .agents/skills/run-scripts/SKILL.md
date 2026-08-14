---
name: run-scripts
description: サーバー等のユーティリティ・管理スクリプトの開発・実行方法と、Bun/TypeScriptのパス解決トラブルシューティング
---

# run-scripts スキル

このスキルは、プロジェクト内（特に `apps/server/scripts/`）で定義されているユーティリティや管理スクリプトを開発および実行する際の共通手順と、モジュールインポート時のパス解決トラブルシューティングについて記述したものです。

## 開発と実行の基本ルール

1. **スクリプトの配置**
   - サーバーサイドの管理スクリプトは `apps/server/scripts/` に配置します。

2. **実行方法**
   - スクリプトの実行は `bun` ランタイムを使用します。
   - 正しいパス解決のため、スクリプトが属するパッケージディレクトリ（例: `apps/server`）をカレントディレクトリにして実行することが推奨されます。

   ```bash
   cd apps/server
   bun scripts/your-script.ts
   ```

3. **環境変数とサービスの初期化**
   - DBクエリや共通サービス（`registry`等）に依存するスクリプトでは、実行の最初期に `initServices()` を呼び出して、設定ファイル（`.env`等）のロードと各種レジストリサービスの設定を行う必要があります。
   ```typescript
   import { initServices } from "../src/infrastructure/bootstrap";
   initServices();
   ```

## パスエイリアス（`~/*`）解決のトラブルシューティング

### 発生する問題

Bun で TypeScript スクリプトを実行する際、次のようなエラーが発生してインポートに失敗することがあります。

```text
error: Cannot find module '~/application/registry' from '/path/to/bootstrap.ts'
```

### 原因と対策

エイリアス解決に失敗した場合は、まず `apps/server` をカレントディレクトリにして実行し、`apps/server/tsconfig.json` の `paths` と `include` を確認します。現行設定では `~/*` は `./src/*` を指し、`scripts/**/*.ts` も include 対象です。`baseUrl` は現在の設定に存在しないため、スクリプト実行のためだけに追加せず、実際のエラーと Bun/TypeScript の解決規則を確認してから変更します。

1. **`paths` と実行ディレクトリの設定**
   - ルートの `tsconfig.json` と `apps/server/tsconfig.json` の継承関係、および `apps/server` を cwd にした実行かを確認します。

2. **`include` の設定**
   - 実行するスクリプトが置かれているディレクトリ（例: `scripts/**/*.ts`）が、`tsconfig.json` の `include` 対象に含まれていることを確認します。
   ```json
   // apps/server/tsconfig.json
   {
     "compilerOptions": {
       "paths": {
         "~/*": ["./src/*"]
       }
     },
     "include": ["src", "src/**/*.ts", "src/**/*.tsx", "scripts/**/*.ts"]
   }
   ```
