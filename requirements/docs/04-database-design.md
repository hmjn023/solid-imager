
# データベース設計

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
