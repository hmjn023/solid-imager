# AGENTS.md - solid-imager

## プロジェクト概要

AI生成画像などを整理・検索・配信するメディア管理システム。

## 主要ドキュメント

- **UIデザインシステム:** [./DESIGN.md](./DESIGN.md)（実装前に参照し、`bun run design:lint` で検証）
- **API仕様:** [OpenAPI 仕様](./apps/server/public/openapi.json) に対応する REST API は `/api/rest`、型付き RPC は `/api/rpc`。Scalar API Reference は `/docs/scalar`（旧 `/api-docs.html` からも転送）。
- **API契約:** `packages/core/src/domain/contract/`（Server実装の集約は `apps/server/src/infrastructure/api/app-router.ts`）
- **Tauri SPA:** [`./apps/tauri/src/`](./apps/tauri/src/)、Rust側は [`./apps/tauri/src-tauri/`](./apps/tauri/src-tauri/)
- **Web UI実装状況:** [`./REPORT.md`](./REPORT.md)
- **DBスキーマ:** `packages/db/src/schema.ts` (`apps/server/src/infrastructure/db/schema.ts` は再 export)
- **開発・管理スクリプト:** [docs/development.md](docs/development.md)（セットアップ、Bun実行、サービス初期化、パス解決）
- **CLI開発:** [apps/cli/README.md](apps/cli/README.md)
- **ブラウザ拡張開発:** [apps/xtracter/README.md](apps/xtracter/README.md)

## 開発ルール & 内部構成

### プロジェクト構成

- **`apps/server`**: `@solid-imager/server` (TanStack Start + oRPC)
- **`apps/tauri`**: `@solid-imager/tauri` (Tauri + 独立 SPA)
- **`apps/cli`**: `@solid-imager/cli` (Bun compileによるシングルバイナリ)
- **`apps/xtracter`**: ブラウザ拡張機能
- **`packages/core`**: `@solid-imager/core` (ドメインモデル、Zodスキーマ、contract、リポジトリIF)
- **`packages/application`**: `@solid-imager/application` (ユースケース・アプリケーションサービス)
- **`packages/db`**: `@solid-imager/db` (Drizzleスキーマ、DBリポジトリ実装)
- **`packages/ui`**: `@solid-imager/ui` (Shared UI Components)
- **`packages/client`**: `@solid-imager/client` (oRPC client factory)

### サーバー内部構成 (`apps/server/src/`)

- `infrastructure/`: API実装・router集約・ServiceRegistry、File System、AI連携、Job Queue、server固有のDB wiring。
- `presentation/`: ルート定義, グローバルストア。
- `components/`, `routes/`, `hooks/`: UIおよびルーティング関連。

共通のユースケース・ポートは `packages/application/` に置き、server固有のサービス実装は `apps/server/src/infrastructure/services/` に置く。

### コア内部構成 (`packages/core/src/domain/`)

- ドメインごとにディレクトリを分離（`media`, `tags`, `characters`, `ips`, `authors` 等）。
- 各ドメイン配下に `schemas.ts` を配置し、Zodスキーマを定義する。
- APIやドメイン境界で共有する型はZod schemaから `z.infer` で導出し、同じデータ構造の型を別に手書きしない。

### パッケージの公開 API

- すべてのワークスペースは内部利用とし、`package.json` に `"private": true` を設定する。
- 境界をまたぐimportは `package.json` の `exports`、パッケージ内は相対import。TypeScript・Vite・Vitestでworkspace解決を共用する。
- 実行用アプリは `apps/*`、共有機能は `packages/*`。router実装はserver内、クライアントの契約型は `@solid-imager/core/contract` から取得する。
- ドメイン型・schema・portは `@solid-imager/core/media` など機能別入口、HTTPパスは `@solid-imager/core/http` を使う。
- ユースケースへ必要なrepository操作だけを渡し、serverでapplication factoryに依存を注入する。用途別port・移行先は[パッケージ境界](docs/architecture/workspace-public-api.md)を参照。
- DB組み立ては `@solid-imager/db` の `createRepositories`、テーブルは `@solid-imager/db/schema`。
- Web/TauriのTailwindは `@solid-imager/ui/tailwind-preset` を使い、共有部品のクラス探索範囲は `theme.css` で指定する。
- `bun run lint:boundaries` で設定・スクリプト・テストを含む境界越え・未公開入口・未宣言workspace依存を検出する。
- 状態と画面の入口を分ける（例: `@solid-imager/ui/search/state`、`@solid-imager/ui/screens/jobs`）。状態だけの利用で画面を読み込ませない。

### アーキテクチャルール (Clean Architecture)

- **依存方向:** `infrastructure` -> `application` -> `core` (Domain)。コアは他へ依存しない。
- **リポジトリ層:** DB行は `packages/db/src/repositories/` のmapperで変換し、二重キャストで不整合を隠さない。
- **セキュリティ:** 機密情報を含み得るエンティティは公開フィールドを明示したSafe DTOへ変換する。
- **データベース:** エンティティIDのDB既定値はUUID v7。中間テーブルは `media_{entity}` 命名とし、複合PKは各schemaに従う。
- **型安全性:** アプリケーション本体コードで `any`、不要な `unknown`、`as unknown as ...`、`as any` による型のごまかしは禁止。外部ライブラリ境界では公開型、型ガード、Zod schema、明示的 mapper を優先し、やむを得ない場合は最小スコープに限定して理由をコメントする。テストコードの mock では例外的に許容する。

## 共通の実装規約

- 型だけのimportは `import type`。名前付きexportを使用し、default exportは避ける。
- クラスの可視性は `private` / `protected` を使い、`#private` や明示的な `public` は使わない。再代入しないプロパティは `readonly`。
- 型・クラスはUpperCamelCase、変数・関数はlowerCamelCase、グローバル定数はCONSTANT_CASE。識別子の先頭・末尾の `_` は避ける。
- `var`、`namespace`、`const enum`、プリミティブのラッパーインスタンス、`eval` / `Function` は使わない。厳密等価比較を使い、意味のない `{}` 型は避ける。
- 明白な型は推論を使い、オプショナル値は `?`、単純な配列は `T[]` を優先する。JSDocにTypeScriptと重複する型を書かない。
- Bun固有APIはserver側で利用できる。ブラウザ・Tauri・共有パッケージではNode互換APIまたはWeb標準APIを優先する。
- 通常のコード修正では開発サーバーを起動しない。UI・ブラウザ検証に必要な時は既存ポートを確認して起動する。
- フォーマットは `.oxfmtrc.json`、lintは `.oxlintrc.json` を正本とし、クォートやインデントの規則を別に重複定義しない。

## Web toolchain

- Viteを開発サーバーとビルドに使用する。
- Vitestをunit/integration testに使用する。
- Oxlintをlint、Oxfmtをformatに使用する。Oxlintのtype-awareルールと`@shadcn/lint`を有効化する。
- 依存取得後は `bun install`、検証時は `bun run check` と `bun run test` を実行する。
