# ComfyUIメディア管理システム 設計書

## 目次
1. [概要](#概要)
2. [システム要件](#システム要件)
3. [技術スタック](#技術スタック)
4. [データベース設計](#データベース設計)
5. [API設計](#api設計)
6. [機能詳細仕様](#機能詳細仕様)
7. [実装優先度](#実装優先度)
8. [将来拡張機能](#将来拡張機能)

---

## 概要

ComfyUIで生成した画像・動画などのメディアを管理するためのバックエンドAPIシステム。

### 主要機能
- メディアソース管理（ローカル/SFTP/S3）
- メディア配信・サムネイル生成
- メタデータ抽出（prompt/workflow）
- リアルタイム更新通知（SSE）
- メディアアップロード・編集
- 検索・ソート・タグ管理
- 設定管理

### 用語定義
- **メディアソース**: ファイルが保存されている場所、及びその管理形態
- **サブディレクトリ**: 特定のメディアソース内にあるディレクトリ、及びその内部の再帰的なディレクトリ
- **メディア一覧**: 特定のメディアソースに保存されているメディアやそのサブディレクトリをグリッド状に表示する画面
- **メディア情報**: 名称、メディアのサイズ、ファイルサイズ、作成日時、更新日時などの情報
- **生成情報**: メディアが生成された際にpngのtEXt領域に保存される情報（prompt、workflow）
- **タグ**: メディアを生成する際にワークフローに入力したキーワード情報（promptやworkflowに含まれている）

---

## システム要件

### 対応メディアソース
- バックエンドが稼働しているマシンのローカルディレクトリ
- SFTP接続先のディレクトリ
- AWS S3

### 対応メディア形式
**初期対応:**
- 画像ファイル: `png`, `jpg`, `jpeg`, `webp`, `gif`

**将来対応予定:**
- 動画ファイル: `mp4`, `webm`, `mov` + ffmpeg サムネイル生成
- 音声ファイル: `mp3`, `wav`, `flac` + 波形生成

---

## 技術スタック

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

---

## データベース設計

### 基本テーブル構成

#### media_sources テーブル
```sql
CREATE TABLE media_sources (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,                 -- 表示されるメディアソースの名前
  description TEXT,                   -- メディアソースの説明
  type TEXT NOT NULL CHECK (type IN ('local', 'sftp', 's3')), -- メディアソースの種類
  connection_info JSONB NOT NULL,     -- 接続情報(JSON)
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- 作成日時
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()  -- 更新日時
);
```

#### media テーブル
```sql
CREATE TABLE media (
  id UUID PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES media_sources(id) ON DELETE CASCADE, -- どのメディアソースに属しているか
  file_path TEXT NOT NULL,           -- ソース内の相対パス
  file_name TEXT NOT NULL,           -- ファイル名
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio')), -- メディア種別
  width INTEGER NOT NULL,            -- メディアの幅
  height INTEGER NOT NULL,           -- メディアの高さ
  file_size BIGINT,                  -- バイト数
  
  -- アップロード時の追加情報
  description TEXT,                  -- メディア説明（ユーザー入力）
  source_url TEXT,                   -- 取得元リンク（ユーザー入力）
  
  -- ファイル情報
  created_at TIMESTAMP NOT NULL,     -- ファイル作成日時
  modified_at TIMESTAMP NOT NULL,    -- ファイル更新日時
  indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),     -- DB登録日時
  
  UNIQUE(source_id, file_path)
);
```

#### tags テーブル
```sql
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,          -- タグの名前 (例: "blue eyes")
  description TEXT,                   -- タグの詳細な説明
  attribute TEXT,                     -- タグの属性や分類 (例: "style", "clothing")
  color TEXT,                         -- UIで表示する際の色 (例: "#808080")
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### media_tags テーブル
```sql
CREATE TABLE media_tags (
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE, -- メディアID
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,   -- タグID
  PRIMARY KEY (media_id, tag_id)
);
```

### 拡張テーブル

#### media_details テーブル (評価・管理系)
```sql
CREATE TABLE media_details (
  media_id UUID PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE, -- メディアID
  rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5), -- 評価 (0-5)
  favorite BOOLEAN DEFAULT FALSE,     -- お気に入り
  view_count INTEGER DEFAULT 0,       -- 閲覧回数
  last_viewed_at TIMESTAMP DEFAULT '1970-01-01 00:00:00' -- 最終閲覧日時
);
```

#### media_generation_info テーブル (AI/機械学習系)
```sql
CREATE TABLE media_generation_info (
  media_id UUID PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE, -- メディアID
  metadata JSONB,                    -- prompt, workflow等
  ai_generated BOOLEAN DEFAULT FALSE, -- AIによって生成されたかどうか
  model_name TEXT DEFAULT '',      -- 使用されたモデル名
  seed BIGINT DEFAULT -1,             -- シード値
  cfg_scale REAL DEFAULT 0,           -- CFGスケール
  steps INTEGER DEFAULT 0             -- ステップ数
);
```

#### media_organization テーブル (分類・整理系)
```sql
CREATE TABLE media_organization (
  media_id UUID PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE, -- メディアID
  category_id INTEGER REFERENCES categories(id), -- カテゴリID
  project_id INTEGER REFERENCES projects(id),   -- プロジェクトID
  ip_id INTEGER REFERENCES ips(id), -- IP(作品)ID
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')) -- 状態
);
```

#### media_technical_info テーブル (技術情報)
```sql
CREATE TABLE media_technical_info (
  media_id UUID PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE, -- メディアID
  color_profile TEXT DEFAULT '',     -- カラープロファイル
  exif_data JSONB DEFAULT '{}',       -- EXIFデータ
  hash_md5 TEXT DEFAULT '',          -- MD5ハッシュ
  hash_perceptual TEXT DEFAULT '',  -- 知覚ハッシュ
  duration_seconds REAL,      -- 再生時間 (秒)
  frame_rate REAL,            -- フレームレート (fps)
  bitrate_kbps INTEGER,       -- ビットレート (kbps)
  video_codec TEXT,           -- 動画コーデック (例: H.264)
  audio_codec TEXT            -- 音声コーデック (例: AAC)
);
```

#### media_sync テーブル (バックアップ・同期用)
```sql
CREATE TABLE media_sync (
  media_id UUID PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE, -- メディアID
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')), -- 同期ステータス
  backup_urls TEXT[] DEFAULT '{}'    -- バックアップURL
);
```

#### categories テーブル
```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,          -- カテゴリ名
  description TEXT DEFAULT '',       -- カテゴリの説明
  color TEXT DEFAULT '#808080',      -- UIで表示する際の色
  parent_id INTEGER REFERENCES categories(id), -- 親カテゴリID
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### projects テーブル
```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                 -- プロジェクト名
  description TEXT DEFAULT '',       -- プロジェクトの説明
  created_at TIMESTAMP DEFAULT NOW(),  -- 作成日時
  archived_at TIMESTAMP             -- アーカイブ日時
);
```

#### ips テーブル
```sql
CREATE TABLE ips (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,          -- IP(作品)名
  description TEXT                    -- IP(作品)の説明
);
```

#### characters テーブル
```sql
CREATE TABLE characters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                 -- キャラクター名
  ip_id INTEGER REFERENCES ips(id) ON DELETE SET NULL, -- どのIP(作品)に属しているか
  description TEXT,                   -- キャラクターの説明
  UNIQUE(name, ip_id)
);
```

#### media_characters テーブル
```sql
CREATE TABLE media_characters (
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,       -- メディアID
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE, -- キャラクターID
  PRIMARY KEY (media_id, character_id)
);
```

#### view_history テーブル
```sql
CREATE TABLE view_history (
  id SERIAL PRIMARY KEY,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE, -- メディアID
  viewed_at TIMESTAMP DEFAULT NOW(),    -- 閲覧日時
  ip_address TEXT,                    -- IPアドレス
  user_agent TEXT DEFAULT ''         -- ユーザーエージェント
);
```

#### similar_media テーブル
```sql
CREATE TABLE similar_media (
  id SERIAL PRIMARY KEY,
  media1_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE, -- メディア1のID
  media2_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE, -- メディア2のID
  similarity_score REAL DEFAULT 0,    -- 類似度スコア
  algorithm TEXT DEFAULT 'perceptual', -- 類似度計算アルゴリズム
  created_at TIMESTAMP DEFAULT NOW()   -- 作成日時
);
```

#### users テーブル
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name TEXT NOT NULL,                 -- ユーザー名
  email TEXT NOT NULL UNIQUE,         -- メールアドレス
  password TEXT NOT NULL,             -- パスワード
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- 作成日時
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()  -- 更新日時
);
```

#### collections テーブル
```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- どのユーザーのコレクションか (ユーザー管理を導入する場合)
  name TEXT NOT NULL,                 -- コレクション名
  description TEXT,                   -- コレクションの説明
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- 作成日時
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()  -- 更新日時
);
```

#### collection_media テーブル
```sql
CREATE TABLE collection_media (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE, -- コレクションID
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,       -- メディアID
  display_order INTEGER, -- コレクション内での表示順序
  PRIMARY KEY (collection_id, media_id)
);
```

### インデックス
```sql
-- 基本テーブル
CREATE INDEX idx_media_source_id ON media(source_id);
CREATE INDEX idx_media_file_name ON media(file_name);
CREATE INDEX idx_media_created_at ON media(created_at);
CREATE INDEX idx_media_description ON media(description) WHERE description IS NOT NULL;
CREATE INDEX idx_tags_name ON tags(name);

-- 拡張テーブル
CREATE INDEX idx_media_generation_info_metadata ON media_generation_info USING gin(metadata) WHERE metadata IS NOT NULL;
CREATE INDEX idx_media_details_rating ON media_details(rating) WHERE rating > 0;
CREATE INDEX idx_media_details_favorite ON media_details(favorite) WHERE favorite = TRUE;
CREATE INDEX idx_media_details_view_count ON media_details(view_count);
CREATE INDEX idx_media_generation_info_ai_generated ON media_generation_info(ai_generated);
CREATE INDEX idx_media_generation_info_model_name ON media_generation_info(model_name) WHERE model_name != '';
CREATE INDEX idx_media_organization_category_id ON media_organization(category_id);
CREATE INDEX idx_media_organization_project_id ON media_organization(project_id);
CREATE INDEX idx_media_organization_ip_id ON media_organization(ip_id);
CREATE INDEX idx_media_organization_status ON media_organization(status);
CREATE INDEX idx_media_technical_info_hash_md5 ON media_technical_info(hash_md5) WHERE hash_md5 != '';
CREATE INDEX idx_similar_media_score ON similar_media(similarity_score);
```

---

## API設計

### 共通原則
- RESTful設計原則に準拠
- 一貫したエンドポイント命名規則
- HTTP動詞の適切な使い分け
- エラーハンドリングの統一
- **パスのワイルドカード (`*`)**: `/api/sources/:id/media/*` や `/api/sources/:id/directories/*` のようなパスにおける `*` は、ソース内のメディアまたはディレクトリの「完全な相対パス」を表します。SolidStartのルーティングでは `[...param]` を使用して表現されます。
- **パス処理の補足**: メディアリスト取得の `?path=subdir` と、特定のメディア操作の `*` ワイルドカードは、それぞれ異なるユースケース（フィルタリングと特定リソースの指定）に対応しています。
- **APIバージョニング**: 将来的な拡張性と後方互換性を考慮し、APIバージョニング（例: `/v1/api/...`）の導入を検討します。

### エンドポイント一覧

#### カテゴリ管理
```
GET    /api/categories              # すべてのカテゴリを一覧表示します。
POST   /api/categories              # 新しいカテゴリを作成します。
GET    /api/categories/:id          # 特定のカテゴリの詳細を取得します。
PUT    /api/categories/:id          # 特定のカテゴリを更新します。
DELETE /api/categories/:id          # 特定のカテゴリを削除します。
```

#### キャラクター管理
```
GET    /api/charactors              # すべてのキャラクターを一覧表示します。
POST   /api/charactors              # 新しいキャラクターを作成します。
GET    /api/charactors/:id          # 特定のキャラクターの詳細を取得します。
PUT    /api/charactors/:id          # 特定のキャラクターを更新します。
DELETE /api/charactors/:id          # 特定のキャラクターを削除します。
```

#### IP (知的財産) 管理
```
GET    /api/ips                     # すべてのIP（知的財産）を一覧表示します。
POST   /api/ips                     # 新しいIPを作成します。
GET    /api/ips/:id                 # 特定のIPの詳細を取得します。
PUT    /api/ips/:id                 # 特定のIPを更新します。
DELETE /api/ips/:id                 # 特定のIPを削除します。
```

#### メディアソース管理
```
GET    /api/sources                 # すべてのメディアソースを一覧表示します。
POST   /api/sources                 # 新しいメディアソースを作成します。
GET    /api/sources/:sourceId       # 特定のメディアソースの詳細を取得します。(sourceId: UUID)
PUT    /api/sources/:sourceId       # 特定のメディアソースを更新します。(sourceId: UUID)
DELETE /api/sources/:sourceId       # 特定のメディアソースを削除します。(sourceId: UUID)
POST   /api/sources/:sourceId/test  # メディアソースへの接続をテストします。(sourceId: UUID)
GET    /api/sources/:sourceId/status # 特定のメディアソースの状態を取得します。(sourceId: UUID)
GET    /api/sources/:sourceId/directories # 特定のメディアソース内のディレクトリ一覧を取得します。(sourceId: UUID)
GET    /api/sources/:sourceId/directories/[...directories] # 特定のディレクトリ下のすべてのメディアとディレクトリを取得します。(sourceId: UUID, directories: path)
```

#### メディア管理
```
GET    /api/sources/:sourceId/:mediaId                  # 特定のメディアの詳細を取得します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/details          # 特定のメディアのタグ、メタデータ、カテゴリ、IP、キャラクターなどの情報を取得します。(sourceId: UUID, mediaId: UUID)
PUT    /api/sources/:sourceId/:mediaId                  # 特定のメディア情報を更新します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/metadata         # 特定のメディアのメタデータを取得します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/tags             # 特定のメディアのタグ一覧を取得します。(sourceId: UUID, mediaId: UUID)
GET    /api/sources/:sourceId/:mediaId/thumbnail        # 特定のメディアのサムネイルを配信します。(sourceId: UUID, mediaId: UUID)
POST   /api/sources/:sourceId/:mediaId/upload           # メディアをアップロードします。アップロードパスはリクエストボディで提供されます。
GET    /api/sources/:sourceId/:mediaId/charactors       # メディアに関連付けられたすべてのキャラクターを取得します。(現在プレースホルダー)
GET    /api/sources/:sourceId/:mediaId/ips              # メディアに関連付けられたすべてのIPを取得します。(現在プレースホルダー)
GET    /api/sources/:sourceId/search                    # 特定のメディアソース内のメディアを検索します。(sourceId: UUID)
GET    /api/sources/:sourceId/directories/[...directories]/search # 特定のサブディレクトリ内のメディアを検索します。(sourceId: UUID, directories: path)
```
**注記: これらの機能はまだ実装されていません。**

#### サムネイル管理
```
GET    /api/sources/:sourceId/:mediaId/thumbnail        # 特定のメディアのサムネイルを配信します。(sourceId: UUID, mediaId: UUID)
POST   /api/sources/:sourceId/thumbnails                # サムネイルの手動生成を開始します。(sourceId: UUID)
DELETE /api/sources/:sourceId/thumbnails                # サムネイルキャッシュをクリアします。(sourceId: UUID)
```
**注記: これらの機能はまだ実装されていません。**

#### ディレクトリ管理
```
GET    /api/sources/:sourceId/directories?path=parent   # ディレクトリ一覧を取得します。(sourceId: UUID)
POST   /api/sources/:sourceId/directories               # ディレクトリを作成します。(sourceId: UUID, body: { path: string, name: string })
PUT    /api/sources/:sourceId/directories/rename        # ディレクトリ名を変更します。(sourceId: UUID, body: { oldPath: string, newPath: string })
DELETE /api/sources/:sourceId/directories/delete        # ディレクトリを削除します。(sourceId: UUID, body: { path: string })
```
**注記: これらの機能はまだ実装されていません。**

#### リアルタイム更新
```
GET    /api/sources/:sourceId/events                    # SSE（Server-Sent Events）を監視し、リアルタイム更新を受け取ります。(sourceId: UUID)
```
**注記: この機能はまだ実装されていません。**

#### 設定管理
```
GET    /api/config                               # アプリケーション設定を取得します。
PUT    /api/config                               # アプリケーション設定を更新します。
POST   /api/config                               # アプリケーション設定をデフォルトにリセットします。
```

#### タグ管理
```
GET    /api/tags                 # すべてのタグを一覧表示します。
POST   /api/tags                 # 新しいタグを作成します。
GET    /api/tags/:id            # 特定のタグの詳細を取得します。
PUT    /api/tags/:id            # 特定のタグを更新します。
DELETE /api/tags/:id            # 特定のタグを削除します。
```

#### データ構造
```typescript
interface MediaSource {
  id: string;           // UUID自動生成
  name: string;         // 表示されるメディアソースの名前
  description: string;  // メディアソースの説明
  type: 'local' | 'sftp' | 's3';
  connectionInfo: ConnectionInfo;
  createdAt: Date;
  updatedAt: Date;
}

type ConnectionInfo = LocalConnection | SftpConnection | S3Connection;

interface LocalConnection {
  path: string;         // "/home/user/media"
}

interface SftpConnection {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath: string;   // "/remote/path/media"
}

interface S3Connection {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix?: string;      // "my-folder/subfolder"
}
```

### 2. メディア配信・サムネイル作成機能

#### サムネイル仕様
- サイズ: クエリパラメータで指定 (?size=200, ?size=400等)
- キャッシュ: ローカルディスクにキャッシュ保存
- 対応形式: PNG, JPEG, WebP
- 生成: バックグラウンド生成（ジョブキュー）

#### サムネイル生成タイミング
- メディアソース追加時: 既存メディアの一括生成開始
- SSEで新メディア検知時: 個別メディアの生成開始
- 手動トリガー: 再生成API提供

#### 進捗通知（SSE）
```typescript
interface ThumbnailProgress {
  type: 'thumbnail_progress';
  sourceId: string;
  status: 'started' | 'processing' | 'completed' | 'error';
  progress: {
    current: number;    // 処理済みメディア数
    total: number;      // 総メディア数
    currentFile?: string;
  };
  error?: string;
}
```

### 3. メディアメタデータ抽出機能

#### データ構造
```typescript
interface MediaMetadata {
  // ComfyUI標準フィールド（JSON解析）
  prompt?: object;     // JSON.parse(textChunk["prompt"])
  workflow?: object;   // JSON.parse(textChunk["workflow"])
  
  // その他のキー（テキストのまま）
  parameters?: string;
  [key: string]: any;  // 将来的な拡張用
}
```

#### 処理仕様
1. PNGメディアからtEXtチャンクを読み取り
2. `prompt`, `workflow`キーはJSON解析を試行
3. 解析失敗時はテキストとして保持
4. その他キーはテキストのまま
5. メタデータが存在しない場合は空オブジェクト返却

### 4. SSE機能

#### 対象範囲
- `type: 'local'` のメディアソースのみ対応
- SFTP/S3は非対応

#### データ構造
```typescript
interface FileSystemEvent {
  type: 'added' | 'deleted' | 'modified';
  sourceId: string;
  filePath: string;    // 相対パス
  timestamp: Date;
}
```

#### 監視仕様
- ライブラリ: chokidar でファイルシステム監視
- 対象: メディアファイル（.png, .jpg, .jpeg, .webp等）
- 範囲: サブディレクトリも再帰的に監視
- エラー: 非localソースは "ローカルファイルソースのみ対応" エラー

### 5. メディアアップロード機能

#### リクエスト形式（multipart/form-data）
```typescript
interface UploadRequest {
  file: File;                    // アップロードファイル
  filename?: string;             // カスタムファイル名
  autoIncrement?: boolean;       // 自動インクリメント有効化
  description?: string;          // メディア説明
  sourceUrl?: string;            // 取得元リンク
  overwrite?: boolean;           // 上書き許可
}
```

#### レスポンス形式
```typescript
interface UploadResponse {
  success: boolean;
  filePath: string;              // 保存されたパス
  conflict?: {                   // 重複時
    existingFile: string;
    suggestedName: string;
  }
}
```

#### 対応状況
- **Phase 1**: `type: 'local'` のみ対応
- **Phase 2**: SFTP/S3 対応予定

#### ファイル名処理
- カスタム名優先、未指定時は元ファイル名使用
- `autoIncrement: true` 時は `media_001.png`, `media_002.png` 形式
- 重複時は `conflict` 情報を返してユーザー確認要求

### 6. 設定管理機能

#### 設定構造
```typescript
interface AppConfig {
  // サーバー設定
  server?: {
    port?: number;
    host?: string;
  };
  
  // メディア処理設定
  media?: {
    supportedFormats?: string[];     // ['png', 'jpg', 'jpeg', 'webp'] (将来: 動画・音声も)
    thumbnailSizes?: number[];       // [200, 400, 800]
    cacheDirectory?: string;
    autoGenerate?: boolean;          // ソース追加時の自動生成
    maxConcurrentJobs?: number;      // 同時生成数制限
    // 将来拡張: videoThumbnailTime?, audioWaveform? 等
  };
  
  // アップロード設定
  upload?: {
    maxFileSize?: number;           // バイト数
    allowOverwrite?: boolean;
  };
  
  // 拡張用
  [key: string]: any;
}
```

#### ファイル保存
- 保存場所: プロジェクトルート `config.json`
- フォーマット: JSON形式
- 自動バックアップ: 更新時に `config.json.backup` 作成

### 7. メディアソート・検索機能

#### ソート条件
```typescript
interface SortOptions {
  field: 'name' | 'createdAt' | 'modifiedAt' | 'fileSize';
  order: 'asc' | 'desc';
}
```

#### 検索条件
```typescript
interface SearchOptions {
  tags?: string[];        // タグ検索（AND/OR）
  filename?: string;      // ファイル名部分一致
  dateRange?: {          // 日付範囲
    from?: Date;
    to?: Date;
  };
}
```

#### 実装方針
- **Phase 1**: ファイルシステムベース（都度メタデータ読み取り）
- **Phase 2**: DB対応でパフォーマンス改善予定
- ページネーション対応（デフォルト50件）
- タグ検索は AND 条件で実装

### 8. メディア情報編集機能

#### リクエスト形式
```typescript
interface UpdateMediaRequest {
  filename?: string;        // ファイル名変更（実ファイルもリネーム）
  description?: string;     // メディア説明
  sourceUrl?: string;       // 取得元リンク
  tags?: string[];         // タグ配列（完全置換）
}
```

#### レスポンス形式
```typescript
interface UpdateMediaResponse {
  success: boolean;
  updatedFields: string[];  // 変更されたフィールド一覧
  oldFilePath?: string;     // ファイル名変更時の旧パス
  newFilePath?: string;     // ファイル名変更時の新パス
  warnings?: string[];      // 重複等の注意事項
}
```

#### ファイル名変更仕様
- 実際のファイルシステムでもリネーム実行
- 重複時はエラーまたは自動リネーム
- DBのfile_pathとfile_nameを更新
- サムネイルキャッシュは既存のまま保持

#### タグ処理
- 新しいタグは自動でtagsテーブルに作成
- media_tagsテーブルは完全置換（既存削除→新規追加）

### 9. ディレクトリ管理機能

#### 対応範囲
- **Phase 1**: `type: 'local'` のみ対応
- **Phase 2**: SFTP/S3 対応予定

#### 作成機能
```typescript
interface CreateDirectoryRequest {
  name: string;          // 作成するディレクトリ名
  recursive?: boolean;   // 親ディレクトリも作成
}

interface CreateDirectoryResponse {
  success: boolean;
  fullPath: string;      // 作成されたフルパス
  created: string[];     // 実際に作成されたディレクトリ一覧
}
```

#### 削除機能
```typescript
interface DeleteDirectoryRequest {
  force?: boolean;       // 空でなくても削除
}

interface DeleteDirectoryResponse {
  success: boolean;
  deletedFiles?: number; // 削除されたメディア数
  warnings?: string[];   // 警告メッセージ
}
```

#### 削除処理詳細
1. 空でないディレクトリは `force: true` 必須
2. 削除対象メディアをDBから検索・削除
3. サムネイルキャッシュも連動クリーンアップ
4. 実際のディレクトリ削除実行

---

## 実装優先度

### 🔴 Phase 1: MVP（最小価値提供）

**Priority 1 - 基盤構築:**
1. 環境セットアップ - PostgreSQL + Drizzle + 依存関係インストール
2. メディアソース管理 - localメディアソースのCRUD（SFTP/S3は後回し）
3. 設定管理 - config.json の基本読み書き

**Priority 2 - 基本メディア機能:**
4. メディア配信 - ローカルメディアの表示（サムネイルは後回し）
5. メディア一覧 - ディレクトリ内メディアの取得・表示
6. メタデータ抽出 - PNG tEXt領域からprompt/workflow取得

### 🟡 Phase 2: 実用性向上（使い勝手改善）

**Priority 3 - UI/UX改善:**
7. サムネイル生成 - バックグラウンド生成 + 進捗通知
8. メディア検索・ソート - ファイル名・日付ソート
9. SSE監視 - ファイル追加/削除のリアルタイム更新

**Priority 4 - 管理機能:**
10. メディアアップロード - ファイル保存 + 重複チェック
11. メディア情報編集 - 説明・タグ・ファイル名変更
12. ディレクトリ管理 - フォルダ作成・削除

### 🟢 Phase 3: 高度機能（差別化）

**Priority 5 - 拡張機能:**
13. タグ検索 - メタデータからタグ抽出・検索
14. SFTP/S3対応 - メディアソース拡張
15. バルク操作 - 一括編集・移動・削除

**実装方針:**
- Phase 1完了でMVP完成（ComfyUIメディア管理の基本価値提供）
- Phase 2完了で日常使いツール（実用性・快適性確保）  
- Phase 3完了で本格的メディア管理システム（競争優位性）

---

## 将来拡張機能

### 1. バルク操作機能
複数メディアの一括処理による効率化
- POST /api/sources/:id/media/bulk-edit - 複数メディアの一括編集
- DELETE /api/sources/:id/media/bulk-delete - 複数メディアの一括削除  
- POST /api/sources/:id/media/bulk-move - 複数メディアの一括移動
- POST /api/sources/:id/media/bulk-tag - 複数メディアの一括タグ付け

### 2. 統計・分析機能
データ分析とパフォーマンス監視
- GET /api/sources/:id/stats - ソース統計（メディア数、サイズ等）
- GET /api/stats/global - 全体統計
- GET /api/sources/:id/media/duplicates - 重複メディア検出
- GET /api/sources/:id/media/*/similar - 類似メディア検索
- GET /api/analytics/popular - 人気メディアランキング

### 3. エクスポート・インポート機能
データ移行とバックアップ支援
- GET /api/sources/:id/export?format=zip - アーカイブエクスポート
- POST /api/sources/:id/import - インポート（URL/ファイル）
- GET /api/sources/:id/media/*/download - メディアダウンロード
- POST /api/sources/clone/:sourceId - ソース複製

### 4. ワークフロー・自動化機能
バックグラウンドタスクとジョブ管理
- POST /api/sources/:id/sync - 手動同期実行
- GET /api/jobs - ジョブ一覧・ステータス
- POST /api/jobs/:id/cancel - ジョブキャンセル
- POST /api/sources/:id/auto-tag - AI自動タグ付け

### 5. フィルタ・プリセット機能
検索条件の保存と再利用
- GET /api/filters/presets - 保存済みフィルタ
- POST /api/filters/presets - フィルタ保存
- GET /api/sources/:id/media/random - ランダムメディア取得
- GET /api/sources/:id/media/recent - 最近のメディア

### 6. 外部連携機能
ComfyUIや他サービスとの統合
- POST /api/integrations/comfyui/upload - ComfyUIに直接アップロード
- GET /api/integrations/comfyui/workflows - ワークフロー一覧
- POST /api/integrations/discord/webhook - Discord通知

---

## 補足情報

### 開発コマンド
- **Install dependencies**: `bun install`
- **Run development server**: `bun run dev` (runs with hot reload on port 3000)

### 対応環境
- Runtime: Bun
- Database: PostgreSQL 15+
- Platform: Linux, macOS, Windows