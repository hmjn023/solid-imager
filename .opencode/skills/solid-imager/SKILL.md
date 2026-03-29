---
name: solid-imager
description: solid-imager プロジェクトの全体像、モノレポ構成、クリーンアーキテクチャの依存関係ルール、および共通のコーディング規約（TypeScript/Biome）。開発環境のセットアップ、環境変数の設定、またはプロジェクト全体の設計方針を確認する際に使用してください。
---

# solid-imager プロジェクトスキル

このプロジェクトは、AIによって生成された画像などのメディアを管理する包括的なメディア管理システムです。モノレポ構成で、サーバー(`apps/server`)、コアパッケージ(`packages/core`)、ブラウザ拡張機能(`xtracter`)で構成されています。

## 主要ドキュメント

- **アーキテクチャ:** `docs/architecture/ARCHITECTURE.md`
- **データベース設計:** `apps/server/src/infrastructure/db/schema.ts` (Drizzle スキーマ)
- **API設計:** `docs/design/api-design.md`
- **技術スタック:** `docs/design/technology-stack.md`

## 開発セットアップ

すべてのコマンドは `bun` を使用して実行します。

1. **依存関係のインストール:**
   ```bash
   bun install
   ```

2. **環境変数の設定:**
   ```bash
   cp apps/server/.env.example apps/server/.env
   ```

3. **データベースのセットアップ:**
   - PostgreSQL (Docker):
     ```bash
     sudo -E docker compose --project-directory . up -d
     bun --filter @solid-imager/server db:migrate
     ```
   - PGlite:
     ```bash
     # .env で DB_HOST=pglite を設定
     bun --filter @solid-imager/server db:migrate:pglite
     ```

## Working Rules

### クリーンアーキテクチャ
`ARCHITECTURE.md` に記載されているレイヤー間の依存関係ルールを厳守してください。ドメイン層は他のどのレイヤーにも依存してはいけません。

### 型安全性
`any` 型の使用は避け、TypeScriptの型システムを最大限に活用してください。型定義のインポートには `import type` を使用します。

### インポートエイリアス
- **Server:** `~/*` → `apps/server/src`
- **Core Package:** `@/*` → `packages/core/src`

### Bun固有APIの回避
ポータビリティを確保するため、`Bun.file()` のようなBun固有のAPIの使用は避け、可能な限りNode.js互換のAPIやWeb標準APIを使用してください。

### 開発サーバーの不使用
開発サーバー (`bun run dev`) を起動しないでください。あなたの役割はコードの実装と修正であり、アプリケーションを直接実行することではありません。

### コード品質
コミットする前には、必ず **Biome** を使ってコードの品質をチェックしてください。
```bash
bun run lint          # ルートでのチェック
bun --filter @solid-imager/server check  # サーバー側（型チェック含む）
bun run format        # フォーマットのみ
```

### テスト
```bash
bun run test                                          # ユニット/インテグレーション
bun --filter @solid-imager/server test:e2e            # E2E
```

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
