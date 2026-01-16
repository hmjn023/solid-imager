
# 技術スタック

### 確定技術構成
```
Runtime: Bun, Python 3.13+
Framework: SolidStart, FastAPI (Python Microservice)
API: oRPC (@orpc/server, @orpc/client), Elysia
UI Components: Kobalte (@kobalte/core) + Tailwind CSS + cmdk-solid
Notifications: solid-toast
Logging: Pino
Linter/Formatter: Biome
Data Fetching/State Management: TanStack Query (@tanstack/solid-query)
Client-side Reactive Store: TanStack DB (@tanstack/solid-db)
Form Management: TanStack Form (@tanstack/solid-form)
Unit/Integration Testing: Vitest
E2E Testing: Playwright
Database: PostgreSQL / PGlite
ORM: Drizzle ORM
Image Processing: sharp
Video Processing: fluent-ffmpeg
Archive: archiver, unzipper
Validation: zod
File Watching: chokidar
API Documentation: OpenAPI (自動生成), Swagger UI
AI/ML: dghs-imgutils, onnxruntime, uvicorn
External Tools: yt-dlp, ffmpeg (System binaries)
Dependency Management (Python): uv
```

### 依存関係 (`package.json`)
```json
{
  "dependencies": {
    "@electric-sql/pglite": "^0.3.14",
    "@kobalte/core": "^0.13.11",
    "@orpc/client": "^1.13.2",
    "@orpc/contract": "^1.13.2",
    "@orpc/server": "^1.13.2",
    "@orpc/solid-query": "^1.13.2",
    "@orpc/zod": "^1.13.2",
    "@solidjs/meta": "^0.29.4",
    "@solidjs/router": "^0.15.4",
    "@solidjs/start": "^1.2.1",
    "@tanstack/solid-db": "^0.1.48",
    "@tanstack/solid-form": "^1.26.0",
    "@tanstack/solid-query": "^5.90.13",
    "@tanstack/zod-form-adapter": "^0.42.1",
    "archiver": "^7.0.1",
    "chokidar": "^4.0.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk-solid": "^1.1.2",
    "drizzle-orm": "^0.44.7",
    "elysia": "^1.4.19",
    "fluent-ffmpeg": "^2.1.3",
    "pg": "^8.16.3",
    "pino": "^10.1.0",
    "sharp": "^0.34.5",
    "solid-js": "^1.9.10",
    "solid-toast": "^0.5.0",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-dist": "^5.30.3",
    "tailwind-merge": "^3.4.0",
    "tailwindcss-animate": "^1.0.7",
    "unzipper": "^0.12.3",
    "uuid": "^13.0.0",
    "vinxi": "^0.5.10",
    "zod": "^4.1.13"
  },
  "devDependencies": {
    "@biomejs/biome": "2.2.4",
    "@orpc/openapi": "^1.13.2",
    "@playwright/test": "^1.57.0",
    "@tailwindcss/vite": "^4.1.17",
    "@types/archiver": "^7.0.0",
    "@types/fluent-ffmpeg": "^2.1.28",
    "@types/node": "^24.10.1",
    "@types/pg": "^8.15.6",
    "@types/swagger-jsdoc": "^6.0.4",
    "@types/swagger-ui-dist": "^3.30.6",
    "@types/unzipper": "^0.10.11",
    "@vitest/coverage-v8": "^3.2.4",
    "dotenv": "^17.2.3",
    "drizzle-kit": "^0.31.7",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7",
    "pino-pretty": "^13.1.3",
    "playwright": "^1.57.0",
    "tailwindcss": "^4.1.17",
    "tsx": "^4.20.6",
    "typedoc": "^0.28.15",
    "typescript": "^5.9.3",
    "ultracite": "5.4.4",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^3.2.4"
  }
}
```

### 設定ファイル
- `drizzle.config.ts` - Drizzle ORM の設定（DB接続、マイグレーション管理）
- `tailwind.config.js` - Tailwind CSS の設定
- `playwright.config.ts` - Playwright (E2Eテスト) の設定
- `biome.json` - Biome (Linter/Formatter) の設定
- `vitest.config.ts` - Vitest (Unit/Integrationテスト) の設定
- `compose.yml` - Docker Compose の設定（PostgreSQLデータベース）
- `tsconfig.json` - TypeScript の設定
- `pyproject.toml` - Python プロジェクト設定（依存関係、uv設定）
- `uv.lock` - Python 依存関係のロックファイル

### API アーキテクチャ (oRPC + Elysia)
- **oRPC**: 型安全な RPC フレームワーク
  - クライアント・サーバー間で型定義を共有
  - Zod スキーマによる入力バリデーション
  - OpenAPI 仕様の自動生成
- **Elysia**: 高速な HTTP サーバーフレームワーク
  - oRPC ハンドラーのホスト
  - バイナリコンテンツ配信（画像、動画、ZIP）
  - グローバルエラーハンドリング
- **実装場所**: 
  - ルーター: `src/infrastructure/api/routers/`
  - エントリーポイント: `src/infrastructure/api/app.ts`
  - 型定義: `src/domain/shared/api-contract.ts`
- 詳細は [oRPC実装ガイド](./orpc-guide.md) を参照

### UIコンポーネント (Kobalte + Tailwind CSS + solid-ui)
- shadcn/ui にインスパイアされたUIコンポーネント群が `src/components/ui` に実装されています。
- これらのコンポーネントは、ヘッドレスなUIプリミティブを提供する `@kobalte/core` をベースに構築されています。
- 一部のコンポーネント（`Command`など）は、[solid-ui](https://www.solid-ui.com/)（shadcn/uiのSolid.jsポート）の CLI ツールを使用して追加されています。
- **追加コンポーネント**:
  - `cmdk-solid`: コマンドパレット（Command+K UI）
  - `solid-toast`: トースト通知
- CSSクラスのマージには`clsx`と`tailwind-merge`を使用しています。

### フォーム管理 (TanStack Form)
- **型安全なフォーム状態管理**: フォームの入力値、バリデーション状態、送信状態などを型安全に管理します。
- **バリデーション**: `zod` と `@tanstack/zod-form-adapter` を利用して堅牢なフォームバリデーションを実装します。
- **ヘッドレスUI**: UIコンポーネントに依存しないため、`src/components/ui` で提供されるコンポーネントと組み合わせて柔軟なフォームUIを構築できます。
- **パフォーマンス**: 必要な部分のみを再レンダリングする設計により、フォーム操作時のパフォーマンスを最適化します。

### リアルタイム更新 (Server-Sent Events)
- **SSE (Server-Sent Events)**: サーバーからクライアントへの一方向リアルタイム通信を実装
- **実装場所**: `src/infrastructure/jobs/sse-manager.ts`
- **使用技術**: 
  - Web標準の `ReadableStream` API
  - フロントエンドでは `EventSource` API
- **用途**: 
  - サムネイル生成完了通知
  - バックグラウンドジョブの進捗通知
  - 将来的なファイルシステム監視イベント
- **特徴**:
  - メディアソースごとにクライアントを管理
  - 自動的な接続クリーンアップ
  - 型安全なイベントペイロード

### Python AI サービス
- **FastAPI**: Python製の非同期Webフレームワーク
- **主要ライブラリ**:
  - `dghs-imgutils`: 画像タグ付け、CCIP特徴量抽出
  - `onnxruntime`: 機械学習モデルの推論エンジン
  - `uvicorn`: ASGIサーバー
- **提供機能**:
  - 画像の自動タグ付け（一般タグ、キャラクター、IP）
  - CCIP perceptual hash 抽出
  - 画像間の類似度計算
- **起動方法**: `bun run ai:start`
- **エンドポイント**: `http://localhost:8000`
- 詳細は [Python AIサービスドキュメント](./python-ai-service.md) を参照

### ロギング (Pino)
- **Pino**: 高速なJSON構造化ログライブラリ
- **実装場所**: `src/infrastructure/logger.ts`
- **特徴**:
  - 非常に高速（他のロガーの5-10倍）
  - JSON形式の構造化ログ
  - ログレベル（trace, debug, info, warn, error, fatal）
  - 開発時は `pino-pretty` で見やすく整形
- **使用例**:
  ```typescript
  import { logger } from "~/infrastructure/logger";
  
  logger.info({ userId: "123" }, "User logged in");
  logger.error({ err: error }, "Failed to process request");
  ```

### アーカイブ処理 (archiver / unzipper)
- **archiver**: ZIP アーカイブの作成
  - メディアソースのバックアップ（画像 + JSON）
  - 複数ファイルの一括ダウンロード
- **unzipper**: ZIP アーカイブの展開
  - メディアソースのインポート
  - メタデータの復元
- **実装場所**: 
  - エクスポート: `src/infrastructure/api/routers/sources-router.ts`
  - インポート: `src/infrastructure/api/routers/sources-router.ts`

### ブラウザ拡張機能 (xtracter)
- **Chrome Extension**: X (Twitter) から画像を抽出
- **技術スタック**:
  - TypeScript
  - Vite (ビルドシステム)
  - `@crxjs/vite-plugin` (Chrome Extension プラグイン)
- **機能**:
  - タイムライン画像にダウンロードボタンを追加
  - メタデータ（ツイート内容、投稿者、URL）を JSON で保存
  - solid-imager への直接アップロード
- **ワークスペース**: `xtracter/`
- 詳細は [xtracter/README.md](../../xtracter/README.md) を参照
