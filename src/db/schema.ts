// @biome-ignore lint/style/useNamingConvention: Drizzle ORM uses snake_case for table and column names.
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

// Enums
export const mediaSourceTypeEnum = pgEnum("media_source_type", [
  "local",
  "sftp",
  "s3",
]);
export const mediaOrganizationStatusEnum = pgEnum("media_organization_status", [
  "active",
  "archived",
  "deleted",
]);
export const mediaSyncStatusEnum = pgEnum("media_sync_status", [
  "synced",
  "pending",
  "failed",
]);
export const mediaTypeEnum = pgEnum("media_type", ["image", "video", "audio"]);

// Tables
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

export const media = pgTable(
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
    createdAt: timestamp("created_at").notNull(),
    /** ファイル更新日時 */
    modifiedAt: timestamp("modified_at").notNull(),
    /** DB登録日時 */
    indexedAt: timestamp("indexed_at").notNull().defaultNow(),
  },
  (table) => ({
    sourceId_filePath_unique: unique("source_id_file_path_unique").on(
      table.sourceId,
      table.filePath
    ),
    sourceIdIndex: index("idx_media_source_id").on(table.sourceId),
    fileNameIndex: index("idx_media_file_name").on(table.fileName),
    createdAtIndex: index("idx_media_created_at").on(table.createdAt),
    descriptionIndex: index("idx_media_description").on(table.description),
  })
);

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
    /** 作成日時 */
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    name_unique: unique("tags_name_unique").on(table.name),
    nameIndex: index("idx_tags_name").on(table.name),
  })
);

export const mediaTags = pgTable(
  "media_tags",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    /** タグID */
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaId, table.tagId] }),
  })
);

export const mediaDetails = pgTable(
  "media_details",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .primaryKey()
      .references(() => media.id, { onDelete: "cascade" }),
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

export const mediaGenerationInfo = pgTable(
  "media_generation_info",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .primaryKey()
      .references(() => media.id, { onDelete: "cascade" }),
    /** prompt, workflowなどのメタデータ */
    metadata: jsonb("metadata"),
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
  },
  (table) => ({
    name_unique: unique("categories_name_unique").on(table.name),
  })
);

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  /** プロジェクト名 */
  name: text("name").notNull(),
  /** プロジェクトの説明 */
  description: text("description").default(""),
  /** 作成日時 */
  createdAt: timestamp("created_at").defaultNow(),
  /** アーカイブ日時 */
  archivedAt: timestamp("archived_at"),
});

export const ips = pgTable(
  "ips",
  {
    id: serial("id").primaryKey(),
    /** IP(作品)名 */
    name: text("name").notNull(),
    /** IP(作品)の説明 */
    description: text("description"),
  },
  (table) => ({
    name_unique: unique("ips_name_unique").on(table.name),
  })
);

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
    description: text("description"),
  },
  (table) => ({
    name_ipId_unique: unique("name_ipId_unique").on(table.name, table.ipId),
  })
);

export const mediaCharacters = pgTable(
  "media_characters",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    /** キャラクターID */
    characterId: integer("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mediaId, table.characterId] }),
  })
);

export const mediaOrganization = pgTable(
  "media_organization",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .primaryKey()
      .references(() => media.id, { onDelete: "cascade" }),
    /** カテゴリID */
    categoryId: integer("category_id").references(() => categories.id),
    /** プロジェクトID */
    projectId: integer("project_id").references(() => projects.id),
    /** IP(作品)ID */
    ipId: integer("ip_id").references(() => ips.id),
    /** 状態 */
    status: mediaOrganizationStatusEnum("status").default("active"),
  },
  (table) => ({
    categoryIdIndex: index("idx_media_organization_category_id").on(
      table.categoryId
    ),
    projectIdIndex: index("idx_media_organization_project_id").on(
      table.projectId
    ),
    ipIdIndex: index("idx_media_organization_ip_id").on(table.ipId),
    statusIndex: index("idx_media_organization_status").on(table.status),
  })
);

export const mediaTechnicalInfo = pgTable(
  "media_technical_info",
  {
    /** メディアID */
    mediaId: uuid("media_id")
      .primaryKey()
      .references(() => media.id, { onDelete: "cascade" }),
    /** カラープロファイル */
    colorProfile: text("color_profile").default(""),
    /** EXIFデータ */
    exifData: jsonb("exif_data").default(sql`'{}'`),
    /** MD5ハッシュ */
    hashMd5: text("hash_md5").default(""),
    /** 知覚ハッシュ */
    hashPerceptual: text("hash_perceptual").default(""),

    // Video specific
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

export const mediaSync = pgTable("media_sync", {
  /** メディアID */
  mediaId: uuid("media_id")
    .primaryKey()
    .references(() => media.id, { onDelete: "cascade" }),
  /** 同期ステータス */
  syncStatus: mediaSyncStatusEnum("sync_status").default("synced"),
  /** バックアップURL */
  backupUrls: text("backup_urls").array().default(sql`'{}'`),
});

export const viewHistory = pgTable("view_history", {
  id: serial("id").primaryKey(),
  /** メディアID */
  mediaId: uuid("media_id")
    .notNull()
    .references(() => media.id, { onDelete: "cascade" }),
  /** 閲覧日時 */
  viewedAt: timestamp("viewed_at").defaultNow(),
  /** IPアドレス */
  ipAddress: text("ip_address"),
  /** ユーザーエージェント */
  userAgent: text("user_agent").default(""),
});

export const similarMedia = pgTable(
  "similar_media",
  {
    id: serial("id").primaryKey(),
    /** メディア1のID */
    media1Id: uuid("media1_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    /** メディア2のID */
    media2Id: uuid("media2_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    /** 類似度スコア */
    similarityScore: real("similarity_score").default(0),
    /** 類似度計算アルゴリズム */
    algorithm: text("algorithm").default("perceptual"),
    /** 作成日時 */
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    media1Id_media2Id_algorithm_unique: unique(
      "media1Id_media2Id_algorithm_unique"
    ).on(table.media1Id, table.media2Id, table.algorithm),
    similarityScoreIndex: index("idx_similar_media_score").on(
      table.similarityScore
    ),
  })
);

/** ユーザー */
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
    email_unique: unique("users_email_unique").on(table.email),
  })
);

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  /** どのユーザーのコレクションか (ユーザー管理を導入する場合) */
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** コレクション名 */
  name: text("name").notNull(),
  /** コレクションの説明 */
  description: text("description"),
  /** 作成日時 */
  createdAt: timestamp("created_at").notNull().defaultNow(),
  /** 更新日時 */
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const collectionMedia = pgTable(
  "collection_media",
  {
    /** コレクションID */
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    /** メディアID */
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    /** コレクション内での表示順序 */
    displayOrder: integer("display_order"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collectionId, table.mediaId] }),
  })
);

// Relations
/** メディアソースとメディアのリレーション */
export const mediaSourcesRelations = relations(mediaSources, ({ many }) => ({
  /** メディアソースに属するメディア */
  media: many(media),
}));

/** メディアと他のテーブルのリレーション */
export const mediaRelations = relations(media, ({ one, many }) => ({
  /** メディアが属するメディアソース */

  source: one(mediaSources, {
    fields: [media.sourceId],
    references: [mediaSources.id],
  }),
  /** メディアに付けられたタグ */

  tags: many(mediaTags),
  /** メディアの詳細情報 */

  details: one(mediaDetails, {
    fields: [media.id],
    references: [mediaDetails.mediaId],
  }),
  /** メディアの生成情報 */

  generationInfo: one(mediaGenerationInfo, {
    fields: [media.id],
    references: [mediaGenerationInfo.mediaId],
  }),
  /** メディアの組織情報 */

  organization: one(mediaOrganization, {
    fields: [media.id],
    references: [mediaOrganization.mediaId],
  }),
  /** メディアの技術情報 */

  technicalInfo: one(mediaTechnicalInfo, {
    fields: [media.id],
    references: [mediaTechnicalInfo.mediaId],
  }),
  /** メディアの同期情報 */

  sync: one(mediaSync, {
    fields: [media.id],
    references: [mediaSync.mediaId],
  }),
  /** メディアの閲覧履歴 */

  viewHistory: many(viewHistory),
  /** 類似メディア (media1) */

  similarMedia1: many(similarMedia, { relationName: "media1" }),
  /** 類似メディア (media2) */

  similarMedia2: many(similarMedia, { relationName: "media2" }),
  /** メディアが属するコレクション */

  collectionMedia: many(collectionMedia),
  /** メディアに含まれるキャラクター */

  characters: many(mediaCharacters),
}));

/** タグとメディアのリレーション */
export const tagsRelations = relations(tags, ({ many }) => ({
  /** タグが付与されたメディア */
  media: many(mediaTags),
}));

/** メディアとタグの中間テーブルのリレーション */
export const mediaTagsRelations = relations(mediaTags, ({ one }) => ({
  /** 中間テーブルが参照するメディア */

  media: one(media, {
    fields: [mediaTags.mediaId],
    references: [media.id],
  }),
  /** 中間テーブルが参照するタグ */

  tag: one(tags, {
    fields: [mediaTags.tagId],
    references: [tags.id],
  }),
}));

/** カテゴリの親子関係とメディアとのリレーション */
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  /** 親カテゴリ */

  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "parent_category",
  }),
  /** 子カテゴリ */

  children: many(categories, { relationName: "parent_category" }),
  /** カテゴリに属するメディア */

  media: many(mediaOrganization),
}));

/** プロジェクトとメディアのリレーション */
export const projectsRelations = relations(projects, ({ many }) => ({
  /** プロジェクトに属するメディア */
  media: many(mediaOrganization),
}));

/** IPとメディア、キャラクターのリレーション */
export const ipsRelations = relations(ips, ({ many }) => ({
  /** IPに属するメディア */

  media: many(mediaOrganization),
  /** IPに属するキャラクター */

  characters: many(characters),
}));

/** キャラクターとIP、メディアのリレーション */
export const charactersRelations = relations(characters, ({ one, many }) => ({
  /** キャラクターが属するIP */

  ip: one(ips, {
    fields: [characters.ipId],
    references: [ips.id],
  }),
  /** キャラクターが含まれるメディア */

  media: many(mediaCharacters),
}));

/** メディアとキャラクターの中間テーブルのリレーション */
export const mediaCharactersRelations = relations(
  mediaCharacters,
  ({ one }) => ({
    /** 中間テーブルが参照するメディア */

    media: one(media, {
      fields: [mediaCharacters.mediaId],
      references: [media.id],
    }),
    /** 中間テーブルが参照するキャラクター */

    character: one(characters, {
      fields: [mediaCharacters.characterId],
      references: [characters.id],
    }),
  })
);

/** メディアの組織情報と各テーブルのリレーション */
export const mediaOrganizationRelations = relations(
  mediaOrganization,
  ({ one }) => ({
    /** 組織情報が参照するメディア */

    media: one(media, {
      fields: [mediaOrganization.mediaId],
      references: [media.id],
    }),
    /** 組織情報が参照するカテゴリ */

    category: one(categories, {
      fields: [mediaOrganization.categoryId],
      references: [categories.id],
    }),
    /** 組織情報が参照するプロジェクト */

    project: one(projects, {
      fields: [mediaOrganization.projectId],
      references: [projects.id],
    }),
    /** 組織情報が参照するIP */

    ip: one(ips, {
      fields: [mediaOrganization.ipId],
      references: [ips.id],
    }),
  })
);

/** 閲覧履歴とメディアのリレーション */
export const viewHistoryRelations = relations(viewHistory, ({ one }) => ({
  /** 閲覧履歴が参照するメディア */
  media: one(media, {
    fields: [viewHistory.mediaId],
    references: [media.id],
  }),
}));

/** 類似メディアのリレーション */
export const similarMediaRelations = relations(similarMedia, ({ one }) => ({
  /** 類似メディア1 */

  media1: one(media, {
    fields: [similarMedia.media1Id],
    references: [media.id],
    relationName: "media1",
  }),
  /** 類似メディア2 */

  media2: one(media, {
    fields: [similarMedia.media2Id],
    references: [media.id],
    relationName: "media2",
  }),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  media: many(collectionMedia),
  /** どのユーザーのコレクションか */
  user: one(users, {
    fields: [collections.userId],
    references: [users.id],
  }),
}));

/** コレクションとメディアの中間テーブルのリレーション */
export const collectionMediaRelations = relations(
  collectionMedia,
  ({ one }) => ({
    /** 中間テーブルが参照するコレクション */

    collection: one(collections, {
      fields: [collectionMedia.collectionId],
      references: [collections.id],
    }),
    /** 中間テーブルが参照するメディア */

    media: one(media, {
      fields: [collectionMedia.mediaId],
      references: [media.id],
    }),
  })
);

/** ユーザーとコレクションのリレーション */
export const usersRelations = relations(users, ({ many }) => ({
  /** ユーザーが持つコレクション */
  collections: many(collections),
}));

// Types
export type MediaSource = InferSelectModel<typeof mediaSources>;
export type NewMediaSource = InferInsertModel<typeof mediaSources>;

export type Media = InferSelectModel<typeof media>;
export type NewMedia = InferInsertModel<typeof media>;

export type Tag = InferSelectModel<typeof tags>;
export type NewTag = InferInsertModel<typeof tags>;

export type MediaTag = InferSelectModel<typeof mediaTags>;
export type NewMediaTag = InferInsertModel<typeof mediaTags>;

export type MediaDetails = InferSelectModel<typeof mediaDetails>;
export type NewMediaDetails = InferInsertModel<typeof mediaDetails>;

export type MediaGenerationInfo = InferSelectModel<typeof mediaGenerationInfo>;
export type NewMediaGenerationInfo = InferInsertModel<
  typeof mediaGenerationInfo
>;

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

export type Ip = InferSelectModel<typeof ips>;
export type NewIp = InferInsertModel<typeof ips>;

export type Character = InferSelectModel<typeof characters>;
export type NewCharacter = InferInsertModel<typeof characters>;

export type MediaCharacter = InferSelectModel<typeof mediaCharacters>;
export type NewMediaCharacter = InferInsertModel<typeof mediaCharacters>;

export type MediaOrganization = InferSelectModel<typeof mediaOrganization>;
export type NewMediaOrganization = InferInsertModel<typeof mediaOrganization>;

export type MediaTechnicalInfo = InferSelectModel<typeof mediaTechnicalInfo>;
export type NewMediaTechnicalInfo = InferInsertModel<typeof mediaTechnicalInfo>;

export type MediaSync = InferSelectModel<typeof mediaSync>;
export type NewMediaSync = InferInsertModel<typeof mediaSync>;

export type ViewHistory = InferSelectModel<typeof viewHistory>;
export type NewViewHistory = InferInsertModel<typeof viewHistory>;

export type SimilarMedia = InferSelectModel<typeof similarMedia>;
export type NewSimilarMedia = InferInsertModel<typeof similarMedia>;

export type Collection = InferSelectModel<typeof collections>;
export type NewCollection = InferInsertModel<typeof collections>;

export type CollectionMedia = InferSelectModel<typeof collectionMedia>;
export type NewCollectionMedia = InferInsertModel<typeof collectionMedia>;

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
