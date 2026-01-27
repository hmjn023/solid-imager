# クライアント・サーバ分割アーキテクチャ提案

## 1. 概要
`solid-imager` を共通のコアを持つ2つのアプリケーションに分離し、以下の構成を実現します：
1.  **サーバ（「図書館」）:** メディアのホスティング、管理、提供を行う集中型Webアプリケーション。
2.  **クライアント（「利用者」）:** オフライン動作が可能で、サーバとの同期機能を持つスタンドアロンなデスクトップアプリケーション（Tauri）。

## 2. 技術スタック

| コンポーネント | 技術 | 役割と選定理由 |
| :--- | :--- | :--- |
| **共通フレームワーク** | **SolidJS** + **TanStack Start** | **UIとルーターの統一。** <br> - **サーバ:** パフォーマンスとSEO（公開時）のためにSSRを使用。 <br> - **クライアント:** Tauri内でNode.jsサイドカーなしで動作させるため **SPAモード** を使用。 <br> - **TanStack Router:** ルーティング定義を共有可能にします。 |
| **デスクトップシェル** | **Tauri v2** | **ネイティブ機能。** SolidJS SPAをラップします。ブラウザのFS APIより高速なローカルファイルシステムへのアクセス（Rustコマンド経由）を提供します。 |
| **バックエンド (サーバ)** | **ElysiaJS** | **API ホスト。** 高速なBunネイティブフレームワーク。Web UIとデスクトップクライアントの両方が利用する基盤を提供します。 |
| **通信** | **oRPC** | **型安全な契約 (Contract)。** クライアントとサーバを接続します。手動での型同期なしに、API呼び出しの完全な型安全性を保証し、TanStack Queryと統合されます。 |
| **リアクティブ・ストア** | **TanStack DB** | **ローカルデータ同期。** PGliteの変更を即座にUIに反映（Live Query）。オフライン動作とオプティミスティック更新の基盤となります。 |
| **データベース (サーバ)** | **PostgreSQL** | **中央の信頼できる情報源 (Source of Truth)。** 複数ユーザーと大規模データセットを処理します。 |
| **データベース (クライアント)** | **PGlite** | **ローカル物理ストレージ。** クライアント内で直接動作するWASMベースのPostgres。IndexedDBに永続化されます。 |
| **ORM** | **Drizzle ORM** | **統一されたデータアクセス。** 標準のPostgreSQL（サーバ）とPGlite（クライアント）の両方をサポートします。 |
| **主キー戦略** | **UUID (v4)** | **競合回避。** 全てのデータベーステーブルでUUIDを使用し、オフライン環境下でのID衝突を防止します。 |

## 3. アーキテクチャ詳細

### 3.1 共有コア (`src/shared`)
再利用性を最大化するため、共通ロジックを抽出します：
*   **ドメインモデル:** Media, Authors, Tags などの Zod スキーマ。
*   **UIコンポーネント:** ボタン、レイアウト、メディアカード (SolidJS)。
*   **ビジネスロジック:** 画像処理ユーティリティ、メタデータパーサー。ブラウザ/サーバ両方で動作させるため、Node.js/Bun 固有の API 依存を排除した純粋な TypeScript ロジックに保ちます。
*   **API契約:** oRPC の定義とルーターの型。

### 3.2 サーバ (`apps/server`)
*   **ランタイム:** Bun.
*   **フレームワーク:** TanStack Start (SSR 有効).
*   **DB:** 通常の PostgreSQL.
*   **役割:**
    *   Web UI の提供。
    *   Elysia 経由で `http://server/rpc` エンドポイントを公開。
    *   バックグラウンドジョブ（AIタグ付け、インポート）の実行。

### 3.3 クライアント (`apps/client`)
*   **ランタイム:** Tauri (WebView + Rust).
*   **フレームワーク:** TanStack Start (SPA モード).
*   **DB:** PGlite (`.data/pglite` または Tauri アプリデータディレクトリに永続化).
*   **役割:**
    *   **オフラインモード:** ローカルの PGlite への読み書き。TanStack DB による Live Query で UI を自動更新。
    *   **オンラインモード:** oRPC 経由でサーバに接続し、閲覧/ダウンロードを行う。
    *   **同期:** サーバからメタデータを取得し PGlite に保存。TanStack DB が変更を検知して UI に反映。

## 4. 「ソース拡張」戦略 (Source Extension)
現在 `solid-imager` は `MediaSourceDriver` (`local`, `nextcloud`) を使用しています。このパターンを拡張し、クライアントから見たデータの扱いを統一します。

### 統一 `MediaSource` インターフェース
クライアントはサーバを「**読み取り専用のソース (Read-Only Source)**」の一つとして扱います。

1.  **ローカルソース:**
    *   ドライバ: `LocalFileSystemDriver`
    *   ストレージ: ローカルフォルダ
    *   メタデータ: ローカル PGlite
2.  **リモートサーバソース:**
    *   ドライバ: `SolidImagerServerDriver` (新規)
    *   ストレージ: リモート URL (oRPC/HTTP経由)
    *   メタデータ: oRPC経由で取得 (オフライン閲覧用に PGlite にキャッシュ、または都度クエリ)。
3.  **クライアント固有 (Tauri) ファイルアクセス:**
    *   WebView 内からは直接 `fs` を叩かず、**Tauri IPC (Invoke)** を経由して Rust 側のファイルアクセス機能を呼び出します。
    *   ローカル画像表示には Tauri の `asset://` プロトコルを使用し、高パフォーマンスなプレビューを実現します。

**同期戦略（「貸出」モデル）:**
（Dropboxのように）全てを同期するのではなく、**オンデマンド** アプローチを採用します：
*   **閲覧:** ユーザーが「サーバ」ソースを開くと、クライアントは oRPC 経由でサーバを検索します。
*   **キャッシュ:** アクセスしたメタデータは PGlite にキャッシュします。
*   **ダウンロード:** ユーザーが「ダウンロード」を選択すると、メディアファイルがローカルソースに保存され、メタデータがローカルの PGlite テーブルにコピー（`owned` としてマーク）されます。

## 5. 同期と競合解決 (Sync & Conflict Resolution)
オフライン編集とマルチデバイス同期を支えるため、単純な「最新上書き」ではなく、データの性質に合わせたハイブリッド戦略を採用します。

### 5.1 ハイブリッド競合解決戦略
1.  **フィールド単位の LWW (Field-level Last-Write-Wins):**
    *   行全体を上書きするのではなく、カラム単位（特に JSONB 内のメタデータ）で更新時間を管理。
    *   Aさんがタイトル、Bさんが評価を同時に変更しても、両方の変更がマージされます。
2.  **集合ベースのマージ (Set Merge):**
    *   タグやコレクションへの追加・削除は「和集合」として処理。
    *   どちらかの端末で行われた追加が、他方の古いデータで消されることを防ぎます。
3.  **デルタ同期 (Delta Sync):**
    *   `last_synced_at` 時点以降の変更レコードのみを oRPC で最小転送。

### 5.2 信頼性の確保
*   **オペレーション・ログ (Outbox):**
    *   PGlite 内に行われた操作（タグ追加、評価変更など）をログとして記録。
    *   オンライン復帰時に、これらを順番通りにサーバーへ適用（リプレイ）することで、操作の意図を正確に反映します。

## 6. 移行ロードマップ

### Phase 0: 基盤の整備 (Prerequisites)
*   **目標:** 分割に向けたデータ構造とロジックの整理。
*   **ステップ:**
    1.  **全テーブルの UUID 化:** `serial` ID を UUID に移行。既存データのマイグレーション（IDの流し替えと外部キー更新）を実施。
    2.  **ドメイン層の純粋化:** `src/domain` から環境依存の API を排除し、リポジトリパターンを導入。

### Phase 1: APIの分離と oRPC の導入
*   **目標:** 現在のリポジトリ内で UI とバックエンドロジックを分離し、型安全な RPC 通信を導入する。
*   **ステップ:**
    1.  `elysia`, `@orpc/server`, `@orpc/client`, `@orpc/zod` をインストール。✅ **完了**
    2.  **API Contract の定義 (`src/domain/shared/api-contract.ts`):** Zod スキーマを用いて API の仕様（Input/Output）を定義。これが Core パッケージの型情報の核となる。✅ **完了**
    3.  **Server Router の実装 (`src/infrastructure/api/routers/*.ts`):** Contract に基づき、Application Service を呼び出す実処理を実装。✅ **完了（sources のみ）**
    4.  **Elysia のマウント (`src/routes/api/[...path].ts`):** SolidStart の Catch-all API ルート内で Elysia の `app.handle(request)` を呼び出す。これにより、**Same-Origin 通信による CORS 回避** と Elysia の型安全なルーティングを両立させる。✅ **完了**
    5.  **段階的な API 移行:** 既存の REST API エンドポイントを oRPC に順次移行。
    6.  *検証:* アプリケーションの動作は変わらず、通信が完全に型安全（End-to-End Type Safety）になることを確認。

#### Phase 1.5: 段階的な API 移行計画

既存の REST API エンドポイント（46個）を優先度別に oRPC へ移行します。

##### 移行の優先順位

**Priority 1: コア機能（必須）**
1. **Media Sources API** ✅ **完了**
   - [x] `GET /api/sources` → `orpc.sources.list()`
   - [x] `POST /api/sources` → `orpc.sources.create()`
   - [x] `GET /api/sources/:id` → `orpc.sources.get()`
   - [x] `PUT /api/sources/:id` → `orpc.sources.update()`
   - [x] `DELETE /api/sources/:id` → `orpc.sources.delete()`

2. **Media API**（最重要） ✅ **完了**
   - [x] `GET /api/sources/:id/search` → `orpc.media.search()`
   - [x] `GET /api/sources/:id/:mediaId` → `orpc.media.get()`
   - [x] `PUT /api/sources/:id/:mediaId` → `orpc.media.update()`
   - [x] `DELETE /api/sources/:id/:mediaId` → `orpc.media.delete()`
   - [x] `GET /api/sources/:id/:mediaId/details` → `orpc.media.getDetails()`
   - [x] `GET /api/sources/:id/:mediaId/thumbnail` → `orpc.media.getThumbnail()` (※バイナリ取得はREST維持/将来対応)

3. **Tags API** ✅ **完了**
   - [x] `GET /api/tags` → `orpc.tags.list()`
   - [x] `POST /api/tags` → `orpc.tags.create()`
   - [x] `PUT /api/tags/:id` → `orpc.tags.update()`
   - [x] `DELETE /api/tags/:id` → `orpc.tags.delete()`
   - [x] `GET /api/sources/:id/:mediaId/tags` → `orpc.media.getTags()`
   - [x] `POST /api/sources/:id/:mediaId/tags` → `orpc.media.addTags()`

**Priority 2: メタデータ管理** ✅ **完了**
4. **Projects API**
   - [x] `GET /api/projects` → `orpc.projects.list()`
   - [x] `POST /api/projects` → `orpc.projects.create()`
   - [x] `PUT /api/projects/:id` → `orpc.projects.update()`
   - [x] `DELETE /api/projects/:id` → `orpc.projects.delete()`
   - [x] Media-Project 関連付け

5. **Characters API**
   - [x] `GET /api/characters` → `orpc.characters.list()`
   - [x] `POST /api/characters` → `orpc.characters.create()`
   - [x] `PUT /api/characters/:id` → `orpc.characters.update()`
   - [x] `DELETE /api/characters/:id` → `orpc.characters.delete()`
   - [x] Media-Character 関連付け

6. **IPs API**
   - [x] `GET /api/ips` → `orpc.ips.list()`
   - [x] `POST /api/ips` → `orpc.ips.create()`
   - [x] `PUT /api/ips/:id` → `orpc.ips.update()`
   - [x] `DELETE /api/ips/:id` → `orpc.ips.delete()`
   - [x] Media-IP 関連付け

7. **Categories API**
   - [x] `GET /api/categories` → `orpc.categories.list()`
   - [x] `POST /api/categories` → `orpc.categories.create()`
   - [x] `PUT /api/categories/:id` → `orpc.categories.update()`
   - [x] `DELETE /api/categories/:id` → `orpc.categories.delete()`

**Priority 3: ファイル操作**
8. **Directory API**
   - [x] `GET /api/sources/:id/directories` → `orpc.directories.list()`
   - [x] `POST /api/sources/:id/directories/create` → `orpc.directories.create()`
   - [x] `POST /api/sources/:id/directories/delete` → `orpc.directories.delete()`
   - [x] `POST /api/sources/:id/directories/rename` → `orpc.directories.rename()`
   - [ ] `GET /api/sources/:id/directories/:path` → `orpc.directories.get()` (未実装/リストで代用)
   - [ ] `GET /api/sources/:id/directories/:path/search` → `orpc.directories.search()` (Media APIで代用可能)

9. **Upload API** ✅ **完了**
   - [x] `POST /api/sources/:id/upload` → `orpc.media.upload()`

10. **Media Operations** ✅ **完了**
    - [x] `POST /api/sources/:id/:mediaId/copy` → `orpc.media.copy()`
    - [x] `POST /api/sources/:id/:mediaId/move` → `orpc.media.move()`

**Priority 4: バックグラウンド処理・ユーティリティ** ✅ **完了**
11. **AI API**
    - [x] `POST /api/ai/tag` → `orpc.ai.tag()`
    - [ ] `POST /api/ai/ccip/feature` → `orpc.ai.ccipFeature()` (未定)
    - [ ] `POST /api/ai/ccip/difference` → `orpc.ai.ccipDifference()` (未定)

12. **Thumbnails API** ✅ **完了**
    - [x] `GET /api/sources/:id/thumbnails` → `orpc.thumbnails.list()`
    - [x] `POST /api/sources/:id/thumbnails` → `orpc.thumbnails.generate()`

13. **Import/Export API** ✅ **完了**
    - [x] `GET /api/sources/:id/dump` → `orpc.sources.dump()`
    - [x] `POST /api/sources/:id/restore` → `orpc.sources.restore()`
    - [x] `POST /api/sources/:id/import` → `orpc.sources.importZip()`

14. **Downloads API** ✅ **完了 (xtracter連携済)**
    - [x] `POST /api/downloads` → `orpc.downloads.start()`

15. **Utilities** ✅ **完了**
    - [x] `POST /api/fetch-url` → `orpc.utils.fetchUrl()`
    - [x] `GET /api/config` → `orpc.config.get()`

**Priority 5: リアルタイム通信** ✅ **完了**
16. **SSE (Server-Sent Events)**
    - [x] `/api/sse/:id` → `orpc.sources.events()`
    - [x] `/api/sources/:id/events` → （統合済）
    - [x] `/api/sources/:id/events/thumbnail-progress` → （sse-manager経由で統合）

##### 移行手順（各 API グループごと）

1. **Router の作成**
   ```typescript
   // src/infrastructure/api/routers/media-router.ts
   export const mediaRouter = {
     search: os.input(searchSchema).handler(async ({ input }) => {
       return await MediaService.search(input);
     }),
     // ...
   };
   ```

2. **Contract への追加**
   ```typescript
   // src/domain/shared/api-contract.ts
   export const appRouter = {
     sources: sourcesRouter,
     media: mediaRouter,  // 追加
     tags: tagsRouter,    // 追加
     // ...
   };
   ```

3. **フロントエンドの移行**
   ```typescript
   // Before
   const media = await apiRequest('/api/sources/123/search', schema, { ... });
   
   // After
   const media = await orpc.media.search({ sourceId: '123', ... });
   ```

4. **既存 REST エンドポイントの削除**
   - oRPC への移行が完了し、動作確認が取れたら、対応する `src/routes/api/**/*.ts` ファイルを削除

##### 移行の進め方

- **週次スプリント方式:** 毎週 1〜2 つの API グループを移行
- **並行運用期間:** 各 API は移行後も既存の REST エンドポイントを 1 スプリント維持し、問題がないことを確認してから削除
- **テストの追加:** 各 API 移行時に、oRPC 経由での動作を確認する統合テストを追加

##### 完了条件

- [x] 全 46 エンドポイントが oRPC に移行完了
- [x] `src/routes/api` 配下に残るのは `[...path].ts`（Elysia マウント）のみ
- [x] フロントエンドの全 API 呼び出しが `orpc` クライアント経由（`api-clients` ラッパーを含む）
- [ ] 既存の `src/infrastructure/api-clients/*-api.ts` ファイルを削除または非推奨化（現状はoRPCラッパーとして維持）
- [x] End-to-End の型安全性が確立され、IDE で完全な補完が効く状態

### Phase 2: データレイヤーの抽象化
*   **目標:** アプリケーションが DB の場所（プロセス内 vs ネットワーク越し）やランタイム（Bun vs Tauri）を意識しないようにする。
*   **ステップ:**
    1.  `src/infrastructure/db` を依存注入可能 (Injectable) にリファクタリング。
    2.  `Repository` パターンを作成するか、切り替え可能な `db` インスタンスを持つ Drizzle を使用。
    3.  テストルートで **PGlite** を導入し、現在の Drizzle スキーマで動作することを検証。
    4.  **ファイルシステム操作の抽象化:**
        *   `IFileSystem` インターフェースを定義し、`read`, `write`, `exists` などの操作を抽象化する。
        *   **Server実装:** `Bun.file`, `Bun.write` を使用した高速な実装。
        *   **Client実装:** Tauri の `plugin-fs` を使用した実装。
        *   これにより、ビジネスロジック内での `Bun` 固有 API への直接依存を排除する。

### Phase 3: 分割 (モノレポ化) と TanStack Start への移行
*   **目標:** 異なるビルドターゲットを作成し、基盤フレームワークを TanStack Start に刷新する。
*   **ステップ:**
    1.  リポジトリをモノレポ構成（Turborepo または Bun workspaces）に変換。
    2.  コアコードを `packages/core` に移動。
    3.  **TanStack Start** をベースに `apps/web` (サーバ/SSR) と `apps/desktop` (クライアント/SPA) を新規セットアップ。
    4.  既存の SolidStart コンポーネントを順次 `packages/core` または新アプリへ移植。
    5.  サーバとクライアントが別オリジン（別ドメイン/ポート）となるため、このタイミングで **Elysia 側に CORS 設定を導入**。
    6.  `apps/desktop` で Tauri v2 を初期化。

### Phase 4: クライアントロジックの実装
*   **目標:** クライアントを単体動作させる。
*   **ステップ:**
    1.  SPA モードを使用して `apps/desktop` を実装。
    2.  デスクトップのプライマリ DB として PGlite を接続。
    3.  Web サーバと会話するための `SolidImagerServerDriver` を実装。

## 7. 型安全性戦略 (Type Safety Strategy)
完全な型安全性の確保は、モノレポ化（Phase 3）のタイミングで段階的に実施します。

*   **Phase 0-2 (現在):**
    *   `src/domain` 配下（将来の Core）のみ、厳格な型チェックを適用します。
    *   それ以外の UI やレガシーコードの型エラーは許容し、開発速度を優先します。
*   **Phase 3 (分離時):**
    *   `packages/core`: `strict: true` を強制し、完全な型安全性を確保します。
    *   `apps/web`: 既存コードをここに移動し、緩い型チェック設定 (`tsconfig.json`) を適用します。これにより、大規模な修正なしで分離を実現します。

## 8. 推奨事項
*   **Phase 1 から開始:** アーキテクチャを壊さずに、即座にコード品質（型安全性）を向上させることができます。
*   **両方で `TanStack Start` を使用:** UI コンポーネントやフックの共有が容易になります。
*   **PGlite 同期はシンプルに:** 最初はリモート検索結果の「キャッシュ」から始め、複雑な双方向同期エンジンの構築は避けることを推奨します。
