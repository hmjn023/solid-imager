# Tauri実装計画書 (Implementation Plan)

## 1. プロジェクト構成 (Monorepo Structure)

現在の単一パッケージ構成から、以下のモノレポ構成へ移行します。これにより、コードの再利用性を高めつつ、サーバ/クライアント固有の依存関係を分離します。

```text
.
├── apps/
│   ├── client/          # [新規] Tauri + Solid Frontend (Client)
│   │   ├── src-tauri/   # Rust Backend (Tauri)
│   │   ├── src/         # Solid UI Code (Client specific)
│   │   └── package.json
│   │
│   └── server/          # [既存を移動] Node.js Backend + Web UI
│       ├── src/         # Existing Server Code
│       └── package.json
│
├── packages/
│   ├── core/            # [新規] 共有ロジック (Environment Agnostic)
│   │   ├── src/
│   │   │   ├── domain/  # Entities, Zod Schemas
│   │   │   └── utils/   # Pure TS Utils
│   │   └── package.json
│   │
│   └── db-schema/       # [新規] Drizzle Schema & Migrations
│       ├── src/
│       └── package.json
│
├── package.json         # Root (Bun Workspaces)
└── turbo.json           # Turborepo Config (Optional but recommended)
```

## 2. 抽象化レイヤーの定義 (Abstraction Layers)

クライアント（ブラウザ/Tauri）とサーバ（Node.js）で実装を切り替えるため、以下のインターフェースを定義し、依存性注入（DI）を利用します。

### 2.1 ファイルシステム (`IFileSystem`)
`node:fs` への直接依存を排除します。

```typescript
// packages/core/src/interfaces/file-system.ts
export interface IFileSystem {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listDir(path: string): Promise<string[]>; // readdir
  ensureDir(path: string): Promise<void>;   // mkdir -p
  stat(path: string): Promise<{ size: number; mtime: Date }>;
}
```

*   **Server実装**: `node:fs/promises` をラップ。
*   **Client実装**: Tauriの `fs` プラグイン (`@tauri-apps/plugin-fs`) をラップ。

### 2.2 メディアストレージ (`IMediaStorage`)
`LocalMediaStorage` を抽象化し、画像処理 (`sharp`) や動画処理 (`ffmpeg`) の隠蔽を行います。

```typescript
// packages/core/src/interfaces/media-storage.ts
export interface IMediaStorage {
  saveMedia(file: File | Blob, options: SaveOptions): Promise<MediaFileResult>;
  getThumbnail(path: string): Promise<Uint8Array>;
  generateThumbnail(path: string): Promise<void>;
}
```

### 2.3 設定サービス (`IConfigService`)
環境変数の取得方法を抽象化します。

```typescript
// packages/core/src/interfaces/config-service.ts
export interface IConfigService {
  get(key: string): string | undefined;
  getNumber(key: string, defaultValue?: number): number;
  getBool(key: string, defaultValue?: boolean): boolean;
}
```

## 3. 移行ステップ (Migration Steps)

### Step 1: Core パッケージの抽出
1.  `packages/core` を作成。
2.  `src/domain` 配下のコードを移動。
    *   **注意**: `src/domain/media/utils/hash-utils.ts` 内の `node:crypto`, `node:fs` 依存箇所は、一時的に `apps/server` へ退避するか、抽象化インターフェース経由にリファクタリングする。
3.  Zod スキーマ (`schema.ts`) を全て Core に移動。

### Step 2: 抽象化インターフェースの実装
1.  `src/infrastructure/interfaces/` ディレクトリを作成（後で `packages/core` へ移動）。
2.  上記 `IFileSystem`, `IMediaStorage`, `IConfigService` を定義。
3.  既存の `LocalMediaStorage` を `ServerMediaStorage` にリネームし、`IMediaStorage` を実装するように修正。

### Step 3: アプリケーション層のリファクタリング
1.  `MediaService` などのサービスクラスが、具象クラス (`LocalMediaStorage`) ではなくインターフェース (`IMediaStorage`) に依存するように変更。
2.  DI コンテナ（または簡易的な Factory）を導入し、起動時 (`entry-server.tsx` / `app.tsx`) に実装を注入する仕組みを作る。

### Step 4: モノレポ化とアプリ分割
1.  ルートの `src` を `apps/server/src` に移動。
2.  `apps/client` を `npm create tauri-app` (または `bun create`) で新規作成。
    *   Framework: SolidJS
    *   Variant: TypeScript
3.  `package.json` の `workspaces` を設定。

### Step 5: クライアント実装 (Client Implementation)
1.  `apps/client` に `pglite` をセットアップ。
2.  `apps/server` から oRPC クライアント定義をインポート（または共有パッケージ化）。
3.  **Tauri コマンドの実装**:
    *   Rust側 (`src-tauri`) でファイルアクセスやサムネイル生成の重い処理を実装。
    *   フロントエンドから `invoke` で呼び出すラッパー (`ClientMediaStorage`) を作成。

## 4. DB接続の分離戦略

`src/infrastructure/db/index.ts` の条件分岐を廃止し、ビルド時に決定されるようにします。

*   **apps/server**: `drizzle-orm/node-postgres` と `pg` を使用。
*   **apps/client**: `drizzle-orm/pglite` と `@electric-sql/pglite` を使用。
*   **packages/db-schema**: スキーマ定義のみを持ち、両方から参照される。

## 5. 推奨される作業順序

1.  **Phase 2 (Abstraction)** を現在のリポジトリ構造のまま完了させる。
    *   コードベースが単一の状態で抽象化を行う方が、リファクタリングが容易であるため。
2.  テストが全てパスすることを確認。
3.  **Phase 3 (Monorepo)** を実行し、ディレクトリを物理的に分割する。
4.  **Phase 4 (Client)** でTauriアプリを構築開始する。
