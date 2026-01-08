
# 技術スタック

### 確定技術構成
```
Runtime: Bun, Python 3.13+
Framework: SolidStart, FastAPI (Python Microservice)
UI Components: Kobalte (@kobalte/core) + Tailwind CSS
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
Validation: zod
File Watching: chokidar
API Documentation: Swagger (swagger-jsdoc, swagger-ui-dist)
AI/ML: dghs-imgutils, onnxruntime, uvicorn
External Tools: yt-dlp, ffmpeg (System binaries)
Dependency Management (Python): uv
```

### 依存関係 (`package.json`)
```json
{
  "dependencies": {
    "@electric-sql/pglite": "^0.3.11",
    "@kobalte/core": "^0.13.11",
    "@solidjs/meta": "^0.29.4",
    "@solidjs/router": "^0.15.3",
    "@solidjs/start": "^1.2.0",
    "@tanstack/solid-db": "^0.1.33",
    "@tanstack/solid-form": "^1.23.7",
    "@tanstack/solid-query": "^5.90.6",
    "@tanstack/zod-form-adapter": "^0.42.1",
    "chokidar": "^4.0.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "drizzle-orm": "^0.44.6",
    "fluent-ffmpeg": "^2.1.3",
    "pg": "^8.16.3",
    "sharp": "^0.34.4",
    "solid-js": "^1.9.9",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-dist": "^5.30.1",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7",
    "uuid": "^13.0.0",
    "vinxi": "^0.5.8",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@biomejs/biome": "2.2.4",
    "@playwright/test": "^1.56.1",
    "@tailwindcss/vite": "^4.1.14",
    "@types/fluent-ffmpeg": "^2.1.28",
    "@types/node": "^24.8.1",
    "@types/pg": "^8.15.5",
    "@types/ssh2-sftp-client": "^9.0.5",
    "@types/swagger-jsdoc": "^6.0.4",
    "@types/swagger-ui-dist": "^3.30.6",
    "@vitest/coverage-v8": "^3.2.4",
    "dotenv": "^17.2.3",
    "drizzle-kit": "^0.31.5",
    "playwright": "^1.56.1",
    "tailwindcss": "^4.1.14",
    "tsx": "^4.20.6",
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

### UIコンポーネント (Kobalte + Tailwind CSS + solid-ui)
- shadcn/ui にインスパイアされたUIコンポーネント群が `src/components/ui` に実装されています。
- これらのコンポーネントは、ヘッドレスなUIプリミティブを提供する `@kobalte/core` をベースに構築されています。
- 一部のコンポーネント（`Command`など）は、[solid-ui](https://www.solid-ui.com/)（shadcn/uiのSolid.jsポート）から追加されています。
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
