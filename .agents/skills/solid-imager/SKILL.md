---
name: solid-imager
description: solid-imager プロジェクトの全体像、モノレポ構成、クリーンアーキテクチャ、共通のコーディング規約を扱う。開発環境、依存方向、パッケージ境界、全体設計の確認時に使用する。
---

# solid-imager プロジェクトスキル

このプロジェクトは、AIによって生成された画像などのメディアを管理する包括的なメディア管理システムです。Bun/Vite+ ベースのモノレポで、Web サーバー、Tauri SPA、CLI、ブラウザ拡張、共有ドメイン、アプリケーションサービス、DB 実装、共有 UI を分離しています。

## 現在の主要構成

- `apps/server`: `@solid-imager/server`。TanStack Start + oRPC の Web/SSR アプリ。API ルーター、サーバー固有の wiring、ジョブ、ストレージ実装を持つ。
- `apps/tauri`: Tauri アプリ。`src/` は独立 SPA、`src-tauri/` は Rust 側実装。
- `apps/cli`: `@solid-imager/cli`。管理・同期用 CLI。
- `apps/xtracter`: ブラウザ拡張機能。
- `packages/core`: ドメインスキーマ、ドメイン型、契約、repository/service/interface の port。
- `packages/application`: ユースケース・アプリケーションサービス。原則として `core` の port に依存し、server/DB 固有実装へ依存しない。
- `packages/db`: Drizzle schema、DB repository 実装、transaction manager。
- `packages/ui`: SolidJS 共有 UI、hooks、query options、layout、画面部品。
- `packages/client`: oRPC client factory などの共有クライアント基盤。

## 主要ドキュメント

- **開発ルール:** `AGENTS.md`
- **API設計:** `docs/design/api-design.md`
- **Tauri SPA 設計:** `docs/design/tauri-spa-architecture.md`
- **DBスキーマ:** `packages/db/src/schema.ts` (`apps/server/src/infrastructure/db/schema.ts` は再 export)
- **OpenAPI出力:** `apps/server/public/openapi.json`

## 開発セットアップ

このリポジトリは Vite+ (`vp`) を導入しています。依存関係の更新後や作業開始時は AGENTS.md の Vite+ チェックリストを優先してください。

1. **依存関係のインストール:**
   ```bash
   vp install
   ```

2. **環境変数の設定:**
   ```bash
   cp apps/server/.env.example apps/server/.env
   ```

3. **データベースのセットアップ:**
   - PostgreSQL (Docker):
     ```bash
     sudo -E docker compose --project-directory . up -d
     bun --filter @solid-imager/server run db:migrate
     ```
   - PGlite:
     ```bash
     # apps/server/.env で DB_HOST=pglite を設定
     bun --filter @solid-imager/server run db:migrate:pglite
     ```

## Working Rules

### クリーンアーキテクチャ
依存方向は原則として `apps/*` / `infrastructure` -> `packages/application` -> `packages/core` です。`packages/core` は他のプロジェクト内パッケージへ依存しません。`packages/application` は DB、server、Tauri などの実装詳細へ依存せず、`core` の port とドメイン型を使います。`packages/db` は `core` の repository port を実装します。

### パッケージ境界
既存コードには deep import が多く残っていますが、新規コードでは公開 API を薄く保つ方針を優先します。内部ファイル構成に直接依存する import を増やす前に、適切な barrel、port、factory を用意できないか検討してください。

### 型安全性
`any`、不要な `unknown`、`as unknown as ...`、`as any` による型のごまかしは禁止です。外部ライブラリ境界では公開型、型ガード、Zod schema、明示的 mapper を優先し、やむを得ない場合は最小スコープに限定して理由をコメントします。型定義のインポートには `import type` を使用します。

### インポートエイリアス
- **Server:** `~/*` → `apps/server/src`
- **Core Package:** `@/*` → `packages/core/src`
- **Workspace Packages:** `@solid-imager/core`, `@solid-imager/application`, `@solid-imager/db`, `@solid-imager/ui`, `@solid-imager/client`

### Bun固有APIの活用
サーバー側（`apps/server` など）の実装では Bun API を使えます。ただし、ブラウザ、Tauri、共有パッケージ（`packages/core`, `packages/application`, `packages/ui`, `packages/client` 等）では、ポータビリティを確保するため Node.js 互換 API や Web 標準 API を優先してください。

### 開発サーバー
通常のコード修正では開発サーバーを起動しません。UI 実装やブラウザ検証が必要な場合のみ、既存ポートを確認して `vp dev` など適切なコマンドを使います。

### コード品質
コミット前には Vite+ / Biome / TypeScript のチェックを実行してください。
```bash
vp check
bun run typecheck
```

### テスト
```bash
vp test
bun run test
```

必要に応じて package/app 単位の script も確認して実行します。

## 変更時に参照する関連スキル

- API/oRPC 変更: `orpc-api`, `schema-driven-dev`, `safe-dto`, `api-docs`
- DB schema/repository 変更: `database-schema`, `repository-rules`
- UI 変更: `ui-components`, `tanstack-db`, 必要に応じて `modern-web-guidance`
- AI/ML 連携: `ai-service`
- CLI 変更: `cli`
- ブラウザ拡張: `browser-extension`
- ログ実装・整理: `logging-rules`

### TypeScript コーディング規約 (Google TypeScript Style Guide 基準)

**Language Features:**
- `const`/`let` のみ使用。**`var` は禁止**
- ES6モジュール使用。**`namespace` は禁止**
- 名前付きエクスポート使用。**デフォルトエクスポートは禁止**
- `#private` フィールドは使用せず、TypeScript の `private` 可視性修飾子を使用
- コンストラクタ外で再代入されないプロパティは `readonly` を付与
- **`public` 修飾子は使用しない**（デフォルト）。`private`/`protected` で可視性を制限
- 文字列はシングルクォート使用。テンプレートリテラルは補間・複数行に限定
- 常に厳密等価 (`===`/`!==`) を使用
- **型アサーション (`x as SomeType`) は回避**。必要な場合は明確な正当化を記載

**禁止機能:**
- **`any` 型は禁止**。`unknown` か具体的な型を使用
- `String`/`Boolean`/`Number` ラッパークラスのインスタンス化は禁止
- **セミコロンは明示的に記述**
- `const enum` は禁止。通常の `enum` を使用
- `eval()` と `Function(...string)` は禁止

**命名規則:**
- `UpperCamelCase`: クラス、インターフェース、型、enum、デコレータ
- `lowerCamelCase`: 変数、パラメータ、関数、メソッド、プロパティ
- `CONSTANT_CASE`: グローバル定数値、enum値
- **`_` プレフィックス/サフィックスは禁止**（プライベートプロパティ含む）

**型システム:**
- 簡単で明白な型は型推論に任せる。複雑な型は明示的に記述
- オプショナルパラメータ/フィールド (`?`) を `|undefined` より優先
- 簡単な型は `T[]`、複雑な共用型は `Array<T>` を使用
- **`{}` 型は禁止**。`unknown`/`Record<string, unknown>`/`object` を使用

**コメント:**
- ドキュメントには `/** JSDoc */`、実装コメントには `//` を使用
- `@param`/`@return` に型を記述しない（TypeScriptでは冗長）
