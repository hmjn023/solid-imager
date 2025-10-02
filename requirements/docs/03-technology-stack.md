
# 技術スタック

### 確定技術構成
```
Runtime: Bun
Framework: SolidStart  
UI Components: solid-ui (shadcn/ui for Solid.js)
Linter/Formatter: Biome
Data Fetching/State Management: TanStack Query
Client-side Reactive Store: TanStack DB
Form Management: TanStack Form
Unit/Integration Testing: Vitest & @testing-library/solid
Database: PostgreSQL 15+ (JSONB, UUID対応)
ORM: Drizzle ORM (型安全、高パフォーマンス)
Image Processing: sharp (サムネイル) + ffmpeg (動画対応)
Validation: zod (SolidStart APIルートと統合)
File Watching: chokidar (SSE用ファイルシステム監視)
Authentication: なし (個人利用想定)
```

### 依存関係
```json
{
  "name": "example-with-tailwindcss",
  "type": "module",
  "scripts": {
    "dev": "vinxi dev",
    "build": "vinxi build",
    "start": "vinxi start",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "lint": "biome lint ./src",
    "format": "biome format --fix ./src",
    "check": "biome check --fix ./src",
    "test": "vitest",
    "test:e2e": "playwright test",
    "unsafe-fix": "biome check --fix --unsafe ./src"
  },
  "dependencies": {
    "@kobalte/core": "^0.13.11",
    "@solidjs/meta": "^0.29.4",
    "@solidjs/router": "^0.15.3",
    "@solidjs/start": "^1.2.0",
    "@tanstack/solid-db": "^0.1.25",
    "@tanstack/solid-form": "^1.23.5",
    "@tanstack/solid-query": "^5.90.3",
    "@tanstack/zod-form-adapter": "^0.42.1",
    "chokidar": "^4.0.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "drizzle-orm": "^0.44.5",
    "pg": "^8.16.3",
    "sharp": "^0.34.4",
    "solid-js": "^1.9.9",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7",
    "uuid": "^13.0.0",
    "vinxi": "^0.5.8",
    "zod": "^4.1.11"
  },
  "devDependencies": {
    "@biomejs/biome": "2.2.4",
    "@playwright/test": "^1.55.1",
    "@tailwindcss/vite": "^4.1.13",
    "@types/node": "^24.6.1",
    "@types/pg": "^8.15.5",
    "@types/ssh2-sftp-client": "^9.0.5",
    "@vitest/coverage-v8": "^3.2.4",
    "dotenv": "^17.2.3",
    "drizzle-kit": "^0.31.5",
    "playwright": "^1.55.1",
    "tailwindcss": "^4.1.13",
    "ultracite": "5.4.4",
    "vitest": "^3.2.4"
  },
  "engines": {
    "node": ">=22"
  }
}
```

### 設定ファイル
- `drizzle.config.ts` - DB設定・migration管理
- `schema.sql` - 初期DB構造定義
- `tailwind.config.js` - Tailwind CSS設定
- `playwright.config.ts` - Playwright設定
- `biome.json` - Biome設定
- `vitest.config.ts` - Vitest設定

### UIコンポーネント (solid-ui)
- **初期化コマンド**: `bunx solidui-cli@latest init`
- **コンポーネント追加コマンド**: `bunx solidui-cli@latest add [component]`
- コンポーネント名はshadcn/uiと同じ

### フォーム管理 (TanStack Form)
- **型安全なフォーム状態管理**: フォームの入力値、バリデーション状態、送信状態などを型安全に管理します。
- **バリデーション**: Zodなどのスキーマバリデーションライブラリと連携し、堅牢なフォームバリデーションを実装します。
- **ヘッドレスUI**: UIコンポーネントに依存しないため、`solid-ui`で提供されるコンポーネントと組み合わせて柔軟なフォームUIを構築できます。
- **パフォーマンス**: 必要な部分のみを再レンダリングする設計により、フォーム操作時のパフォーマンスを最適化します。
