// @biome-ignore lint/style/useNamingConvention: Drizzle ORMはテーブル名とカラム名にsnake_caseを使用します。
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// 列挙型
/**
 * Enum for media source types.
 * Defines where the media files are stored and how they are managed.
 */
export const mediaSourceTypeEnum = pgEnum("media_source_type", [
  "local",
  "sftp",
  "s3",
]);
/**
 * Enum for media organization status.
 * Defines the lifecycle status of a media item within the system.
 */
export const mediaOrganizationStatusEnum = pgEnum("media_organization_status", [
  "active",
  "archived",
  "deleted",
]);
/**
 * Enum for media synchronization status.
 * Defines the current state of a media item's synchronization with external backups or systems.
 */
export const mediaSyncStatusEnum = pgEnum("media_sync_status", [
  "synced",
  "pending",
  "failed",
]);
/**
 * Enum for media types.
 * Defines the primary content type of a media file.
 */
export const mediaTypeEnum = pgEnum("media_type", ["image", "video", "audio"]);
/**
 * Enum for job status.
 * Defines the current state of a background job.
 */
export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
]);
/**
 * Enum for media relation types.
 * Defines various ways media items can be related to each other.
 */
export const mediaRelationTypeEnum = pgEnum("media_relation_type", [
  "variant", // 差分・バリエーション
  "version", // 別バージョン
  "page", // ページ（漫画等）
  "derivative", // 派生作品
  "edit", // 編集版
  "source", // 元素材
]);

// テーブル
/**
 * Schema for the media_sources table.
 * Stores information about different media sources configured in the system.
 */
export const mediaSources = pgTable("media_sources", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  /** 表示されるメディアソースの名前 */
  name: text("name").notNull(),
  /** メディアソースの説明 */
  description: text("description"),
  /** メディアソースの種類 */
  type: mediaSourceTypeEnum("type").notNull(),
  /** 接続情報(JSON) */
  connectionInfo: jsonb("connection_info").notNull(),
  /** 作成日時 */
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** 更新日時 */
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Schema for the media table.
 * Stores core information about individual media files.
 */
export const medias = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    /** どのメディアソースに属しているか */
    sourceId: uuid("source_id")
      .notNull()
      .references(() => mediaSources.id, { onDelete: "cascade" }),
    /** ソース内の相対パス */
    filePath: text("file_path").notNull(),
    /** ファイル名 */
    fileName: text("file_name").notNull(),
    /** メディア種別 */
    mediaType: mediaTypeEnum("media_type").notNull(),
    /** メディアの幅 */
    width: integer("width").notNull(),
    /** メディアの高さ */
    height: integer("height").notNull(),
    /** ファイルサイズ(バイト) */
    fileSize: bigint("file_size", { mode: "number" }),
    /** メディアの説明(ユーザー入力) */
    description: text("description"),
    /** 取得元リンク(ユーザー入力) */
    sourceUrl: text("source_url"),
    /** ファイル作成日時 */
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** ファイル更新日時 */
    modifiedAt: timestamp("modified_at").notNull().defaultNow(),
    /** DB登録日時 */
    indexedAt: timestamp("indexed_at").notNull().defaultNow(),
    /** メディアの状態 */
    status: mediaOrganizationStatusEnum("status").notNull().default("active"),
  },
  (table) => ({
    sourceIdFilePathUnique: unique("source_id_file_path_unique").on(
      table.sourceId,
      table.filePath
    ),
    sourceIdIndex: index("idx_media_source_id").on(table.sourceId),
    fileNameIndex: index("idx_media_file_name").on(table.fileName),
    createdAtIndex: index("idx_media_created_at").on(table.createdAt),
    descriptionIndex: index("idx_media_description").on(table.description),
  })
);

/**
 * Schema for the tags table.
 * Stores information about tags used to categorize media.
 */
export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    /** タグの名前 (例: "blue eyes") */
    name: text("name").notNull(),
    /** タグの詳細な説明 */
    description: text("description"),
    /** タグの属性や分類 (例: "style", "clothing") */
    attribute: text("attribute"),
    /** UIで表示する際の色 (例: "#808080") */
    color: text("color"),
    /** タグの起源 (manual, comfyui_workflow, tagger_program_Aなど) */
    source: text("source").notNull().default("manual"),
    /** 作成日時 */
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** 更新日時 */
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameUnique: unique("tags_name_unique").on(table.name),
    nameIndex: index("idx_tags_name").on(table.name),
  })
);

/**
 * Schema for the media_tags join table.
 * Represents the many-to-many relationship between media items and tags.
 */
export const mediaTags = pgTable(
  "media_tags",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .notNull()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** タグID */
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    /** AIがタグを抽出した際の信頼度スコア (0.0-1.0)。手動の場合はNULL */
    confidence: real("confidence"),
    /** メディアへのタグ付与の起源 (manual, comfyui_workflow, tagger_program_Aなど) */
    source: text("source").notNull().default("manual"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaId, table.tagId] }),
  })
);

/**
 * Schema for the media_details table.
 * Stores additional, often user-generated, details about media items.
 */
export const mediaDetails = pgTable(
  "media_details",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .primaryKey()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** 評価 (0-5) */
    rating: integer("rating").default(0),
    /** お気に入り */
    favorite: boolean("favorite").default(false),
    /** 閲覧回数 */
    viewCount: integer("view_count").default(0),
    /** 最終閲覧日時 */
    lastViewedAt: timestamp("last_viewed_at").default(
      sql`'1970-01-01 00:00:00'`
    ),
  },
  (table) => ({
    ratingIndex: index("idx_media_details_rating").on(table.rating),
    favoriteIndex: index("idx_media_details_favorite").on(table.favorite),
    viewCountIndex: index("idx_media_details_view_count").on(table.viewCount),
  })
);

/**
 * Schema for the media_generation_info table.
 * Stores information related to how a media item was generated, especially for AI-generated content.
 */
export const mediaGenerationInfo = pgTable(
  "media_generation_info",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .primaryKey()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** prompt, workflowなどのメタデータ */
    metadata: jsonb("metadata"),
    /** プロンプト文字列 */
    prompt: text("prompt"),
    /** ネガティブプロンプト */
    negativePrompt: text("negative_prompt"),
    /** ComfyUIワークフロー全体 */
    workflow: jsonb("workflow"),
    /** LoRA情報 [{"name": "...", "weight": 0.8}] */
    loras: jsonb("loras"),
    /** VAE名 */
    vae: text("vae"),
    /** Hypernetwork情報 */
    hypernetworks: jsonb("hypernetworks"),
    /** Embedding/Textual Inversion情報 */
    embeddings: jsonb("embeddings"),
    /** AIによって生成されたかどうか */
    aiGenerated: boolean("ai_generated").default(false),
    /** 使用されたモデル名 */
    modelName: text("model_name").default(""),
    /** シード値 */
    seed: bigint("seed", { mode: "number" }).default(-1),
    /** CFGスケール */
    cfgScale: real("cfg_scale").default(0),
    /** ステップ数 */
    steps: integer("steps").default(0),
  },
  (table) => ({
    metadataIndex: index("idx_media_generation_info_metadata").on(
      table.metadata
    ),
    aiGeneratedIndex: index("idx_media_generation_info_ai_generated").on(
      table.aiGenerated
    ),
    modelNameIndex: index("idx_media_generation_info_model_name").on(
      table.modelName
    ),
  })
);

/**
 * Schema for the categories table.
 * Organizes media into user-defined categories.
 */
export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    /** カテゴリ名 */
    name: text("name").notNull(),
    /** カテゴリの説明 */
    description: text("description").default(""),
    /** UIで表示する際の色 */
    color: text("color").default("#808080"),
    /** 親カテゴリID */
    parentId: integer("parent_id").references(() => categories.id),
    /** 作成日時 */
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** カテゴリの起源 (manual) */
    source: text("source").notNull().default("manual"),
    /** 更新日時 */
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameUnique: unique("categories_name_unique").on(table.name),
  })
);

/**
 * Schema for the projects table.
 * Stores information about projects that media items can be associated with.
 */
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  /** プロジェクト名 */
  name: text("name").notNull(),
  /** プロジェクトの説明 */
  description: text("description").default(""),
  /** 作成日時 */
  createdAt: timestamp("created_at").defaultNow(),
  /** 更新日時 */
  updatedAt: timestamp("updated_at").defaultNow(),
  /** アーカイブ日時 */
  archivedAt: timestamp("archived_at"),
});

/**
 * Schema for the ips table.
 * Stores information about Intellectual Properties (IPs) that media items or characters can be associated with.
 */
export const ips = pgTable(
  "ips",
  {
    id: serial("id").primaryKey(),
    /** IP(作品)名 */
    name: text("name").notNull(),
    /** IP(作品)の説明 */
    description: text("description").default(""),
    /** IPの起源 (manual, ai_generatedなど) */
    source: text("source").notNull().default("manual"),
    /** 作成日時 */
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** 更新日時 */
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameUnique: unique("ips_name_unique").on(table.name),
  })
);

/**
 * Schema for the characters table.
 * Stores information about characters, potentially linked to IPs.
 */
export const characters = pgTable(
  "characters",
  {
    id: serial("id").primaryKey(),
    /** キャラクター名 */
    name: text("name").notNull(),
    /** どのIP(作品)に属しているか */
    ipId: integer("ip_id").references(() => ips.id, {
      onDelete: "set null",
    }),
    /** キャラクターの説明 */
    description: text("description").default(""),
    /** キャラクターの起源 (manual, ai_generatedなど) */
    source: text("source").notNull().default("manual"),
    /** キャラクターの別名（エイリアス）のリスト */
    aliases: jsonb("aliases"),
    /** 作成日時 */
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** 更新日時 */
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIpIdUnique: unique("name_ipId_unique").on(table.name, table.ipId),
  })
);

/**
 * Schema for the media_characters join table.
 * Represents the many-to-many relationship between media items and characters.
 */
export const mediaCharacters = pgTable(
  "media_characters",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .notNull()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** キャラクターID */
    characterId: integer("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    /** AIがキャラクターを抽出した際の信頼度スコア (0.0-1.0)。手動の場合はNULL */
    confidence: real("confidence"),
    /** メディアへのキャラクター付与の起源 (manual, ai_generatedなど) */
    source: text("source").notNull().default("manual"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaId, table.characterId] }),
  })
);

/**
 * Schema for the media_categories join table.
 * Represents the many-to-many relationship between media items and categories.
 */
export const mediaCategories = pgTable(
  "media_categories",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .notNull()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** カテゴリID */
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaId, table.categoryId] }),
    categoryIdIndex: index("idx_media_categories_category_id").on(
      table.categoryId
    ),
  })
);

/**
 * Schema for the media_projects join table.
 * Represents the many-to-many relationship between media items and projects.
 */
export const mediaProjects = pgTable(
  "media_projects",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .notNull()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** プロジェクトID */
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaId, table.projectId] }),
    projectIdIndex: index("idx_media_projects_project_id").on(table.projectId),
  })
);

/**
 * Schema for the media_ips join table.
 * Represents the many-to-many relationship between media items and Intellectual Properties (IPs).
 */
export const mediaIps = pgTable(
  "media_ips",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .notNull()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** IP(作品)ID */
    ipId: integer("ip_id")
      .notNull()
      .references(() => ips.id, { onDelete: "cascade" }),
    /** メディアへのIP付与の起源 (manual, ai_generatedなど) */
    source: text("source").notNull().default("manual"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaId, table.ipId] }),
    ipIdIndex: index("idx_media_ips_ip_id").on(table.ipId),
  })
);

/**
 * Schema for the media_technical_info table.
 * Stores technical details about media files, such as color profiles, EXIF data, and video/audio codecs.
 */
export const mediaTechnicalInfo = pgTable(
  "media_technical_info",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .primaryKey()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** カラープロファイル */
    colorProfile: text("color_profile").default(""),
    /** EXIFデータ */
    exifData: jsonb("exif_data").default(sql`'{}'`),
    /** MD5ハッシュ */
    hashMd5: text("hash_md5").default(""),
    /** 知覚ハッシュ */
    hashPerceptual: text("hash_perceptual").default(""),

    // 動画固有
    /** 再生時間 (秒) */
    durationSeconds: real("duration_seconds"),
    /** フレームレート (fps) */
    frameRate: real("frame_rate"),
    /** ビットレート (kbps) */
    bitrateKbps: integer("bitrate_kbps"),
    /** 動画コーデック (例: H.264) */
    videoCodec: text("video_codec"),
    /** 音声コーデック (例: AAC) */
    audioCodec: text("audio_codec"),
  },
  (table) => ({
    hashMd5Index: index("idx_media_technical_info_hash_md5").on(table.hashMd5),
  })
);

/**
 * Schema for the media_sync table.
 * Manages synchronization and backup status for media items.
 */
export const mediaSync = pgTable("media_sync", {
  /** メディアID */
  mediaId: uuid("media_id")
    .primaryKey()
    .references(() => medias.id, { onDelete: "cascade" }),
  /** 同期ステータス */
  syncStatus: mediaSyncStatusEnum("sync_status").default("synced"),
  /** バックアップURL */
  backupUrls: text("backup_urls").array().default(sql`'{}'`),
  /** 最後の同期日時 */
  lastSyncedAt: timestamp("last_synced_at"),
  /** 同期試行回数 */
  syncAttempts: integer("sync_attempts").default(0),
  /** 最後のエラーメッセージ */
  lastError: text("last_error"),
});

/**
 * Schema for the view_history table.
 * Records user views of media items for analytics and personalized recommendations.
 */
export const viewHistory = pgTable("view_history", {
  id: serial("id").primaryKey(),
  /** メディアID */
  mediaId: uuid("media_id")
    .notNull()
    .references(() => medias.id, { onDelete: "cascade" }),
  /** 閲覧日時 */
  viewedAt: timestamp("viewed_at").defaultNow(),
  /** IPアドレス */
  ipAddress: text("ip_address"),
  /** ユーザーエージェント */
  userAgent: text("user_agent").default(""),
});

/**
 * Schema for the similar_media table.
 * Stores relationships between similar media items, often determined by perceptual hashing.
 */
export const similarMedia = pgTable(
  "similar_media",
  {
    id: serial("id").primaryKey(),
    /** メディア1のID */
    media1Id: uuid("media1_id")
      .notNull()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** メディア2のID */
    media2Id: uuid("media2_id")
      .notNull()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** 類似度スコア */
    similarityScore: real("similarity_score").default(0),
    /** 類似度計算アルゴリズム */
    algorithm: text("algorithm").default("perceptual"),
    /** 作成日時 */
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    media1IdMedia2IdAlgorithmUnique: unique(
      "media1Id_media2Id_algorithm_unique"
    ).on(table.media1Id, table.media2Id, table.algorithm),
    similarityScoreIndex: index("idx_similar_media_score").on(
      table.similarityScore
    ),
  })
);

/**
 * Schema for the media_relations table.
 * Manages relationships between media items, such as variants, versions, or pages in a series.
 *
 * @example Variant illustrations
 * parent: "Character_Standing.png"
 *   ├─ child (variant): "Character_Standing_Expression1.png"
 *   ├─ child (variant): "Character_Standing_Expression2.png"
 *   └─ child (variant): "Character_Standing_Outfit.png"
 *
 * @example Manga pages
 * parent: "Manga_Chapter1"
 *   ├─ child (page, order: 1): "page_001.png"
 *   ├─ child (page, order: 2): "page_002.png"
 *   └─ child (page, order: 3): "page_003.png"
 */
export const mediaRelationsTable = pgTable(
  "media_relations",
  {
    id: serial("id").primaryKey(),
    /** 親メディアID */
    parentMediaId: uuid("parent_media_id")
      .notNull()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** 子メディアID */
    childMediaId: uuid("child_media_id")
      .notNull()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** 関係の種類 */
    relationType: mediaRelationTypeEnum("relation_type").notNull(),
    /** ページ番号等の順序（オプショナル） */
    orderIndex: integer("order_index"),
    /** 追加情報（差分内容の説明等）をJSON形式で保存 */
    metadata: jsonb("metadata"),
    /** 作成日時 */
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    parentChildTypeUnique: unique("parent_child_type_unique").on(
      table.parentMediaId,
      table.childMediaId,
      table.relationType
    ),
    parentMediaIdIndex: index("idx_media_relations_parent").on(
      table.parentMediaId
    ),
    childMediaIdIndex: index("idx_media_relations_child").on(
      table.childMediaId
    ),
    relationTypeIndex: index("idx_media_relations_type").on(table.relationType),
  })
);

/**
 * Schema for the users table.
 * Stores user account information.
 */
export const users = pgTable(
  "users",
  {
    /** ユーザーID */
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    /** ユーザー名 */
    name: text("name").notNull(),
    /** メールアドレス */
    email: text("email").notNull(),
    /** パスワード */
    password: text("password").notNull(),
    /** 作成日時 */
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** 更新日時 */
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: unique("users_email_unique").on(table.email),
  })
);

/**
 * Schema for the collections table.
 * Stores user-created collections of media items.
 */
export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  /** どのユーザーのコレクションか (ユーザー管理を導入する場合) */
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** コレクション名 */
  name: text("name").notNull(),
  /** コレクションの説明 */
  description: text("description").default(""),
  /** 作成日時 */
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** 更新日時 */
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Schema for the media_collections join table.
 * Represents the many-to-many relationship between collections and media items.
 */
export const mediaCollections = pgTable(
  "media_collections",
  {
    /** コレクションID */
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    /** メディアID */
    mediaId: uuid("media_id")
      .notNull()
      .references(() => medias.id, { onDelete: "cascade" }),
    /** コレクション内での表示順序 */
    displayOrder: integer("display_order"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collectionId, table.mediaId] }),
  })
);

/**
 * Schema for the jobs table.
 * Manages background jobs such as thumbnail generation, metadata extraction, and bulk tagging.
 * It tracks their progress and results.
 */
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  /** ジョブの種類 (例: "thumbnail_generation", "metadata_extraction", "auto_tagging") */
  type: text("type").notNull(),
  /** 関連するメディアソースID (オプショナル) */
  sourceId: uuid("source_id").references(() => mediaSources.id, {
    onDelete: "cascade",
  }),
  /** ジョブのステータス */
  status: jobStatusEnum("status").notNull().default("pending"),
  /** ジョブの入力パラメータ (JSON) */
  payload: jsonb("payload"),
  /** ジョブの実行結果 (JSON) */
  result: jsonb("result"),
  /** エラーメッセージ (失敗時) */
  error: text("error"),
  /** ジョブ作成日時 */
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** 最終更新日時 */
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Schema for the presets table.
 * Stores user-defined filter presets for searching media.
 * @example valueの保存例
 * ```json
 * {
 *   "tags": [1, 5, 12],
 *   "dateRange": { "from": "2024-01-01", "to": "2024-12-31" },
 *   "rating": 5,
 *   "favorite": true,
 *   "mediaType": "image",
 *   "characters": [3, 7],
 *   "ips": [2]
 * }
 * ```
 */
export const presets = pgTable("presets", {
  id: serial("id").primaryKey(),
  /** プリセット名 (例: "お気に入りの高評価画像", "2024年の青い目キャラクター") */
  name: text("name").notNull().unique(),
  /** フィルター条件をJSON形式で保存 */
  value: jsonb("value").notNull(),
  /** 作成日時 */
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// リレーション
/**
 * Defines the relations for the media_sources table.
 */
export const mediaSourcesRelations = relations(mediaSources, ({ many }) => ({
  /** メディアソースに属するメディア */
  media: many(medias),
}));

/**
 * Defines the relations for the medias table.
 */
export const mediaRelations = relations(medias, ({ one, many }) => ({
  /** メディアが属するメディアソース */

  source: one(mediaSources, {
    fields: [medias.sourceId],
    references: [mediaSources.id],
  }),
  /** メディアに付けられたタグ */

  tags: many(mediaTags),
  /** メディアの詳細情報 */

  details: one(mediaDetails, {
    fields: [medias.id],
    references: [mediaDetails.mediaId],
  }),
  /** メディアの生成情報 */

  generationInfo: one(mediaGenerationInfo, {
    fields: [medias.id],
    references: [mediaGenerationInfo.mediaId],
  }),
  /** メディアが属するカテゴリ */

  categories: many(mediaCategories),
  /** メディアが属するプロジェクト */

  projects: many(mediaProjects),
  /** メディアが属するIP */

  ips: many(mediaIps),
  /** メディアの技術情報 */

  technicalInfo: one(mediaTechnicalInfo, {
    fields: [medias.id],
    references: [mediaTechnicalInfo.mediaId],
  }),
  /** メディアの同期情報 */

  sync: one(mediaSync, {
    fields: [medias.id],
    references: [mediaSync.mediaId],
  }),
  /** メディアの閲覧履歴 */

  viewHistory: many(viewHistory),
  /** 類似メディア (media1) */

  similarMedia1: many(similarMedia, { relationName: "media1" }),
  /** 類似メディア (media2) */

  similarMedia2: many(similarMedia, { relationName: "media2" }),
  /** メディアが属するコレクション */

  collections: many(mediaCollections),
  /** メディアに含まれるキャラクター */

  characters: many(mediaCharacters),
  /** このメディアを親とする関連メディア */

  childRelations: many(mediaRelationsTable, { relationName: "parent" }),
  /** このメディアを子とする関連メディア */

  parentRelations: many(mediaRelationsTable, { relationName: "child" }),
}));

/**
 * Defines the relations for the tags table.
 */
export const tagsRelations = relations(tags, ({ many }) => ({
  /** タグが付与されたメディア */
  media: many(mediaTags),
}));

/**
 * Defines the relations for the media_tags join table.
 */
export const mediaTagsRelations = relations(mediaTags, ({ one }) => ({
  /** 中間テーブルが参照するメディア */

  media: one(medias, {
    fields: [mediaTags.mediaId],
    references: [medias.id],
  }),
  /** 中間テーブルが参照するタグ */

  tag: one(tags, {
    fields: [mediaTags.tagId],
    references: [tags.id],
  }),
}));

/**
 * Defines the relations for the categories table.
 */
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  /** 親カテゴリ */

  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "parent_category",
  }),
  /** 子カテゴリ */

  children: many(categories, {
    relationName: "parent_category",
  }),
  /** カテゴリに属するメディア */

  media: many(mediaCategories),
}));

/**
 * Defines the relations for the projects table.
 */
export const projectsRelations = relations(projects, ({ many }) => ({
  /** プロジェクトに属するメディア */
  media: many(mediaProjects),
}));

/**
 * Defines the relations for the ips table.
 */
export const ipsRelations = relations(ips, ({ many }) => ({
  /** IPに属するメディア */

  media: many(mediaIps),
  /** IPに属するキャラクター */

  characters: many(characters),
}));

/**
 * Defines the relations for the characters table.
 */
export const charactersRelations = relations(characters, ({ one, many }) => ({
  /** キャラクターが属するIP */

  ip: one(ips, {
    fields: [characters.ipId],
    references: [ips.id],
  }),
  /** キャラクターが含まれるメディア */

  media: many(mediaCharacters),
}));

/**
 * Defines the relations for the media_characters join table.
 */
export const mediaCharactersRelations = relations(
  mediaCharacters,
  ({ one }) => ({
    /** 中間テーブルが参照するメディア */

    media: one(medias, {
      fields: [mediaCharacters.mediaId],
      references: [medias.id],
    }),
    /** 中間テーブルが参照するキャラクター */

    character: one(characters, {
      fields: [mediaCharacters.characterId],
      references: [characters.id],
    }),
  })
);

/**
 * Defines the relations for the media_categories join table.
 */
export const mediaCategoriesRelations = relations(
  mediaCategories,
  ({ one }) => ({
    /** 中間テーブルが参照するメディア */
    media: one(medias, {
      fields: [mediaCategories.mediaId],
      references: [medias.id],
    }),
    /** 中間テーブルが参照するカテゴリ */
    category: one(categories, {
      fields: [mediaCategories.categoryId],
      references: [categories.id],
    }),
  })
);

/**
 * Defines the relations for the media_projects join table.
 */
export const mediaProjectsRelations = relations(mediaProjects, ({ one }) => ({
  /** 中間テーブルが参照するメディア */
  media: one(medias, {
    fields: [mediaProjects.mediaId],
    references: [medias.id],
  }),
  /** 中間テーブルが参照するプロジェクト */
  project: one(projects, {
    fields: [mediaProjects.projectId],
    references: [projects.id],
  }),
}));

/**
 * Defines the relations for the media_ips join table.
 */
export const mediaIpsRelations = relations(mediaIps, ({ one }) => ({
  /** 中間テーブルが参照するメディア */
  media: one(medias, {
    fields: [mediaIps.mediaId],
    references: [medias.id],
  }),
  /** 中間テーブルが参照するIP */
  ip: one(ips, {
    fields: [mediaIps.ipId],
    references: [ips.id],
  }),
}));

/**
 * Defines the relations for the view_history table.
 */
export const viewHistoryRelations = relations(viewHistory, ({ one }) => ({
  /** 閲覧履歴が参照するメディア */
  media: one(medias, {
    fields: [viewHistory.mediaId],
    references: [medias.id],
  }),
}));

/**
 * Defines the relations for the similar_media table.
 */
export const similarMediaRelations = relations(similarMedia, ({ one }) => ({
  /** 類似メディア1 */

  media1: one(medias, {
    fields: [similarMedia.media1Id],
    references: [medias.id],
    relationName: "media1",
  }),
  /** 類似メディア2 */

  media2: one(medias, {
    fields: [similarMedia.media2Id],
    references: [medias.id],
    relationName: "media2",
  }),
}));

/**
 * Defines the relations for the mediaRelationsTable.
 */
export const mediaRelationsTableRelations = relations(
  mediaRelationsTable,
  ({ one }) => ({
    /** 親メディア */
    parentMedia: one(medias, {
      fields: [mediaRelationsTable.parentMediaId],
      references: [medias.id],
      relationName: "parent",
    }),
    /** 子メディア */
    childMedia: one(medias, {
      fields: [mediaRelationsTable.childMediaId],
      references: [medias.id],
      relationName: "child",
    }),
  })
);

/**
 * Defines the relations for the collections table.
 */
export const collectionsRelations = relations(collections, ({ one, many }) => ({
  media: many(mediaCollections),
  /** どのユーザーのコレクションか */
  user: one(users, {
    fields: [collections.userId],
    references: [users.id],
  }),
}));

/**
 * Defines the relations for the media_collections join table.
 */
export const mediaCollectionsRelations = relations(
  mediaCollections,
  ({ one }) => ({
    /** 中間テーブルが参照するコレクション */

    collection: one(collections, {
      fields: [mediaCollections.collectionId],
      references: [collections.id],
    }),
    /** 中間テーブルが参照するメディア */

    media: one(medias, {
      fields: [mediaCollections.mediaId],
      references: [medias.id],
    }),
  })
);

/**
 * Defines the relations for the users table.
 */
export const usersRelations = relations(users, ({ many }) => ({
  /** ユーザーが持つコレクション */
  collections: many(collections),
}));

// 型
/**
 * Type definition for selecting a media source from the database.
 */
export type MediaSource = InferSelectModel<typeof mediaSources>;
/**
 * Type definition for inserting a new media source into the database.
 */
export type NewMediaSource = InferInsertModel<typeof mediaSources>;

/**
 * Type definition for selecting a media item from the database.
 */
export type Media = InferSelectModel<typeof medias>;
/**
 * Type definition for inserting a new media item into the database.
 */
export type NewMedia = Omit<
  Media,
  "id" | "createdAt" | "modifiedAt" | "indexedAt" | "status"
>;

/**
 * Type definition for selecting a tag from the database.
 */
export type Tag = InferSelectModel<typeof tags>;
/**
 * Type definition for inserting a new tag into the database.
 */
export type NewTag = InferInsertModel<typeof tags>;

/**
 * Type definition for selecting a media tag relationship from the database.
 */
export type MediaTag = InferSelectModel<typeof mediaTags>;
/**
 * Type definition for inserting a new media tag relationship into the database.
 */
export type NewMediaTag = InferInsertModel<typeof mediaTags>;

/**
 * Type definition for selecting media details from the database.
 */
export type MediaDetails = InferSelectModel<typeof mediaDetails>;
/**
 * Type definition for inserting new media details into the database.
 */
export type NewMediaDetails = InferInsertModel<typeof mediaDetails>;

/**
 * Type definition for selecting media generation information from the database.
 */
export type MediaGenerationInfo = InferSelectModel<typeof mediaGenerationInfo>;
/**
 * Type definition for inserting new media generation information into the database.
 */
export type NewMediaGenerationInfo = InferInsertModel<
  typeof mediaGenerationInfo
>;

/**
 * Type definition for selecting a category from the database.
 */
export type Category = InferSelectModel<typeof categories>;
/**
 * Type definition for inserting a new category into the database.
 */
export type NewCategory = InferInsertModel<typeof categories>;

/**
 * Type definition for selecting a project from the database.
 */
export type Project = InferSelectModel<typeof projects>;
/**
 * Type definition for inserting a new project into the database.
 */
export type NewProject = InferInsertModel<typeof projects>;

/**
 * Type definition for selecting an IP from the database.
 */
export type Ip = InferSelectModel<typeof ips>;
/**
 * Type definition for inserting a new IP into the database.
 */
export type NewIp = InferInsertModel<typeof ips>;

/**
 * Type definition for selecting a character from the database.
 */
export type Character = InferSelectModel<typeof characters>;
/**
 * Type definition for inserting a new character into the database.
 */
export type NewCharacter = InferInsertModel<typeof characters>;

/**
 * Type definition for selecting a media character relationship from the database.
 */
export type MediaCharacter = InferSelectModel<typeof mediaCharacters>;
/**
 * Type definition for inserting a new media character relationship into the database.
 */
export type NewMediaCharacter = InferInsertModel<typeof mediaCharacters>;

/**
 * Type definition for selecting a media category relationship from the database.
 */
export type MediaCategory = InferSelectModel<typeof mediaCategories>;
/**
 * Type definition for inserting a new media category relationship into the database.
 */
export type NewMediaCategory = InferInsertModel<typeof mediaCategories>;

/**
 * Type definition for selecting a media project relationship from the database.
 */
export type MediaProject = InferSelectModel<typeof mediaProjects>;
/**
 * Type definition for inserting a new media project relationship into the database.
 */
export type NewMediaProject = InferInsertModel<typeof mediaProjects>;

/**
 * Type definition for selecting a media IP relationship from the database.
 */
export type MediaIp = InferSelectModel<typeof mediaIps>;
/**
 * Type definition for inserting a new media IP relationship into the database.
 */
export type NewMediaIp = InferInsertModel<typeof mediaIps>;

/**
 * Type definition for selecting media technical information from the database.
 */
export type MediaTechnicalInfo = InferSelectModel<typeof mediaTechnicalInfo>;
/**
 * Type definition for inserting new media technical information into the database.
 */
export type NewMediaTechnicalInfo = InferInsertModel<typeof mediaTechnicalInfo>;

/**
 * Type definition for selecting media sync information from the database.
 */
export type MediaSync = InferSelectModel<typeof mediaSync>;
/**
 * Type definition for inserting new media sync information into the database.
 */
export type NewMediaSync = InferInsertModel<typeof mediaSync>;

/**
 * Type definition for selecting a view history entry from the database.
 */
export type ViewHistory = InferSelectModel<typeof viewHistory>;
/**
 * Type definition for inserting a new view history entry into the database.
 */
export type NewViewHistory = InferInsertModel<typeof viewHistory>;

/**
 * Type definition for selecting similar media relationships from the database.
 */
export type SimilarMedia = InferSelectModel<typeof similarMedia>;
/**
 * Type definition for inserting new similar media relationships into the database.
 */
export type NewSimilarMedia = InferInsertModel<typeof similarMedia>;

/**
 * Type definition for selecting a collection from the database.
 */
export type Collection = InferSelectModel<typeof collections>;
/**
 * Type definition for inserting a new collection into the database.
 */
export type NewCollection = InferInsertModel<typeof collections>;

/**
 * Type definition for selecting a media collection relationship from the database.
 */
export type MediaCollection = InferSelectModel<typeof mediaCollections>;
/**
 * Type definition for inserting a new media collection relationship into the database.
 */
export type NewMediaCollection = InferInsertModel<typeof mediaCollections>;

/**
 * Type definition for selecting a user from the database.
 */
export type User = InferSelectModel<typeof users>;
/**
 * Type definition for inserting a new user into the database.
 */
export type NewUser = InferInsertModel<typeof users>;

/**
 * Type definition for selecting a job from the database.
 */
export type Job = InferSelectModel<typeof jobs>;
/**
 * Type definition for inserting a new job into the database.
 */
export type NewJob = InferInsertModel<typeof jobs>;

/**
 * Type definition for selecting a preset from the database.
 */
export type Preset = InferSelectModel<typeof presets>;
/**
 * Type definition for inserting a new preset into the database.
 */
export type NewPreset = InferInsertModel<typeof presets>;

/**
 * Type definition for selecting a media relation from the database.
 */
export type MediaRelation = InferSelectModel<typeof mediaRelationsTable>;
/**
 * Type definition for inserting a new media relation into the database.
 */
export type NewMediaRelation = InferInsertModel<typeof mediaRelationsTable>;
