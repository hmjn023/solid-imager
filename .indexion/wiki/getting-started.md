# Getting Started

## 前提条件

- [Bun](https://bun.sh/) v1.x
- Docker（PostgreSQL用）
- Node.js互換環境

## インストール

```bash
# 依存関係インストール
bun install

# 環境変数設定
cp apps/server/.env.example apps/server/.env

# PostgreSQL起動（Docker）
sudo -E docker compose --project-directory . up -d

# DBマイグレーション実行
bun --filter @solid-imager/server run db:migrate

# 開発サーバー起動
bun run dev
```

## 主要スクリプト

| コマンド | 用途 |
|---|---|
| `bun run dev` | 開発サーバー起動（全アプリ） |
| `bun run test` | ユニットテスト実行 |
| `bun run test:e2e` | E2Eテスト（Playwright） |
| `bun run lint` | Biomeリントチェック |
| `bun run db:generate` | Drizzleマイグレーション生成 |
| `bun run db:migrate` | マイグレーション適用 |

## アプリ別起動

```bash
# サーバーのみ
bun --filter @solid-imager/server run dev

# Tauriデスクトップアプリ
bun --filter @solid-imager/tauri run tauri dev

# CLIビルド
bun --filter @solid-imager/cli run build
```

## 設定ファイル

| ファイル | 用途 |
|---|---|
| `apps/server/.env` | サーバー環境変数（DB接続、ストレージ設定） |
| `apps/server/drizzle.config.ts` | DBマイグレーション設定 |
| `biome.json` | Linter/Formatter設定 |
| `vitest.workspace.ts` | テスト設定 |
| `compose.yml` | Docker Compose（PostgreSQL） |

## Tauriデスクトップアプリ（スタンドアロン）

Tauriアプリは**PGlite**（Wasmで動くPostgreSQL互換DB）を使用するため、Dockerなしで動作します。

```bash
# Tauri用依存関係（Rust）が必要
cargo --version  # Rust toolchainが必要

bun --filter @solid-imager/tauri run tauri dev
```

## AI解析サービス（オプション）

```bash
cd src-python
pip install -e .
# または
uv sync
uvicorn main:app --reload
```
