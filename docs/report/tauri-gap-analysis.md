# Tauri対応に向けた現状調査レポート (Gap Analysis)

## 1. 概要
本レポートは、現在の `solid-imager` (SolidStart版) を、`docs/spec/client-server-proposal.md` で提案されたクライアント・サーバ分割アーキテクチャ（Tauri + TanStack Start）へ移行するために必要な対応と、現状の乖離（Gap）をまとめたものです。

## 2. 依存関係と結合度 (Dependency Coupling)

### 2.1 Node.js 固有 API への依存
現在のコードベース（特に `infrastructure` 層）は、Node.js ランタイムに強く依存しており、そのままでは Tauri（ブラウザ環境）で動作しません。

*   **ファイルシステム (`node:fs`, `node:path`)**:
    *   **影響箇所**: `src/infrastructure/storage/local-media-storage.ts`, `src/domain/media/utils/hash-utils.ts` (ドメイン層での違反あり)
    *   **問題点**: ブラウザには `fs` が存在しない。Tauri では Rust 側のコマンド経由または `tauri-plugin-fs` を利用する必要がある。
    *   **改善策**: `IFileSystem` インターフェースによる抽象化と、環境別（Server/Client）の実装注入。

*   **暗号化 (`node:crypto`)**:
    *   **影響箇所**: `src/domain/media/utils/hash-utils.ts`
    *   **問題点**: ドメイン層で使用されており、純粋な TypeScript ロジックになっていない。
    *   **改善策**: Web Crypto API への書き換え、または `ICryptoProvider` による抽象化。

*   **ネイティブモジュール (`sharp`, `fluent-ffmpeg`, `pg`)**:
    *   **影響箇所**: `src/infrastructure/storage/local-media-storage.ts`, `src/infrastructure/db/index.ts`
    *   **問題点**:
        *   `sharp`: Node.js バイナリ依存。Tauri では Rust Image crate または Canvas API で代用が必要。
        *   `fluent-ffmpeg`: 子プロセス起動 (`spawn`) が必要。Tauri では Sidecar としてバンドルし、Command 経由で呼び出す必要がある。
        *   `pg`: `node-postgres` はブラウザ不可。PGlite (`@electric-sql/pglite`) への完全な切り替えが必要。

### 2.2 データベース接続のハードコード
`src/infrastructure/db/index.ts` は `process.env` を読み取り、条件分岐で `pg` または `pglite` を初期化しています。
*   **問題点**: `import { Pool } from "pg"` がトップレベルにあるため、バンドラー（Vite）がブラウザ向けビルドを行う際にエラーとなる可能性が高い。
*   **改善策**: DB初期化ロジックをファクトリーパターン化し、依存性の注入（DI）を行うことで、クライアントビルドから `pg` を完全に排除する。

## 3. フレームワークとアーキテクチャ (Framework & Architecture)

### 3.1 SolidStart vs TanStack Start
現状は `@solidjs/start` (Vinxiベース) と `FileRoutes` を使用しています。提案にある `TanStack Start` への移行は、アプリケーションの根幹に関わる大規模な変更となります。

*   **ルーティング**: `FileRoutes` から TanStack Router のファイルベースルーティングへの書き換えが必要。
*   **コンポーネント**: `<A>`, `<Router>` などの Solid Router コンポーネントの置換。
*   **データフェッチ**: 現状の `createQuery` (TanStack Query) は維持できるが、SSR/ローダーの仕組みがフレームワークごとに異なるため調整が必要。

### 3.2 環境変数の扱い
*   **現状**: `process.env` を多用 (`src/application/services/config-service.ts` 等)。
*   **Tauri**: `import.meta.env` または Tauri の `loadConfig` API を使用する必要がある。
*   **改善策**: `IConfigService` を定義し、環境変数の取得元を隠蔽する。

## 4. モノレポ構成への移行
現状は単一の `package.json` で管理されています。
*   **必要な分割**:
    1.  `packages/core`: ドメインモデル、Zodスキーマ、純粋なユーティリティ（Node依存なし）。
    2.  `apps/server`: 現在のバックエンドロジック、Node.js API実装、Elysia サーバー。
    3.  `apps/client`: Tauri + Solid フロントエンド、PGlite、クライアント用ドライバ実装。

## 5. 機能的な不足 (Missing Features)

*   **更新メカニズム**: デスクトップアプリとしての自動更新機能が未実装。
*   **同期ロジック**: クライアント(PGlite)とサーバ(Postgres)間のデータ同期ロジック（提案書の「同期戦略」）が実装されていない。
*   **設定UI**: サーバのURLや認証情報を入力するための「接続設定」画面が必要。

## 6. 結論
最もリスクが高いのは **「Node.js 依存の排除と抽象化」** です。特に `LocalMediaStorage` は全面的にリファクタリングが必要です。
フレームワーク移行（SolidStart -> TanStack Start）は工数が大きいものの、技術的な不確実性は低いです。
まずは **「抽象化レイヤーの導入」** を Phase 2 として最優先で実施することを推奨します。
