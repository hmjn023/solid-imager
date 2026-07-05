# solid-imager

AI生成画像などのメディアを管理する包括的なメディア管理システム。

## 機能

- 複数メディアソース対ース対応（ローカル/SFTP/S3）
- メタデータ管理（プロンプト、タグ、キャラクター、IP）
- 検索・ソート・サムネイル生成
- リアルタイム更新 (SSE)
- AI自動タグ付け

## 技術スタック

```
Runtime: Bun
Framework: TanStack Start
API: oRPC
UI: Kobalte + Tailwind CSS + solid-ui
Database: PostgreSQL / PGlite
ORM: Drizzle ORM
Validation: Zod
AI/ML: dghs-imgutils-rs
Testing: Vitest / Playwright
Tooling: Vite+ / Biome
```

### プロジェクト構成（モノレポ）

- `apps/server/`: メインサーバー (TanStack Start + oRPC)。バックエンドAPIとWeb UIを統合。
- `apps/tauri/`: Tauri アプリ。`src/` は独立 SPA、`src-tauri/` は Rust 実装。
- `apps/cli/`: メディア管理・同期用CLIツール。
- `apps/xtracter/`: メディア収集用ブラウザ拡張機能。
- `packages/core/`: ドメインモデル、Zodスキーマ、contract、各種 port。
- `packages/application/`: ユースケース・アプリケーションサービス。
- `packages/db/`: Drizzle schema、DB repository 実装、transaction manager。
- `packages/ui/`: 共通UIコンポーネントライブラリ。
- `packages/client/`: oRPC client factory などの共有クライアント基盤。

## セットアップ

```bash
bun x vp install
cp apps/server/.env.example apps/server/.env
sudo -E docker compose --project-directory . up -d
bun --filter @solid-imager/server run db:migrate
bun run dev
```

### AI ネイティブ依存（GPU 対応）

AI自動タグ付けに使用する `dghs-imgutils-rs` は Rust の N-API アドオンです。GPU (CUDA) を有効にするには、システムにインストールされた共有 ONNX Runtime を動的リンクしてビルドしてください。

```bash
ORT_PREFER_DYNAMIC_LINK=1 ORT_LIB_PATH=/usr/lib bun x vp install
```

要件:
- `/usr/lib/libonnxruntime.so.1` と `/usr/lib/libonnxruntime_providers_cuda.so` が存在すること
- NVIDIA ドライバーと CUDA ランタイムがインストールされていること

CPU のみで使用する場合は通常通り `bun x vp install` してください。

## 主要スクリプト

| コマンド | 用途 |
|---|---|
| `bun run dev` | 開発サーバー起動 |
| `bun x vp check` | format / lint / typecheck |
| `bun x vp test` | Vite+ 管理下のテスト |
| `bun run test` | ワークスペース横断テスト |
| `bun run lint` | lint |
| `bun --filter @solid-imager/server run db:generate` | マイグレーション生成 |

## 設定ファイル

| ファイル | 用途 |
|---|---|
| `packages/db/src/schema.ts` | Drizzle DBスキーマ |
| `apps/server/drizzle.config.ts` | DB接続、マイグレーション |
| `biome.json` | Linter/Formatter |
| `vitest.workspace.ts` | Vitest workspace |
| `apps/server/playwright.config.ts` | E2Eテスト |
| `compose.yml` | PostgreSQL (Docker) |

## 詳細

- **API設計**: [docs/design/api-design.md](./docs/design/api-design.md)
- **Tauri SPA設計**: [docs/design/tauri-spa-architecture.md](./docs/design/tauri-spa-architecture.md)
- **DBスキーマ**: `packages/db/src/schema.ts`
- **開発ルール**: [AGENTS.md](./AGENTS.md)
