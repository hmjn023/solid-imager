import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	unique,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// テーブル
/**
 * Schema for the media_sources table.
 * Stores information about different media sources configured in the system.
 */
export const mediaSources = sqliteTable("media_sources", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** 表示されるメディアソースの名前 */
	name: text("name").notNull(),
	/** メディアソースの説明 */
	description: text("description"),
	/** メディアソースの種類 */
	type: text("type", { enum: ["local", "sftp", "s3"] }).notNull(),
	/** 接続情報(JSON) */
	connectionInfo: text("connection_info", { mode: "json" }).notNull(),
	/** 作成日時 */
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
	/** 更新日時 */
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
});

/**
 * Schema for the media table.
 * Stores core information about individual media files.
 */
export const medias = sqliteTable(
	"media",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** どのメディアソースに属しているか */
		mediaSourceId: text("source_id")
			.notNull()
			.references(() => mediaSources.id, { onDelete: "cascade" }),
		/** ソース内の相対パス */
		filePath: text("file_path").notNull(),
		/** ファイル名 */
		fileName: text("file_name").notNull(),
		/** メディア種別 */
		mediaType: text("media_type", {
			enum: ["image", "video", "audio"],
		}).notNull(),
		/** メディアの幅 */
		width: integer("width").notNull(),
		/** メディアの高さ */
		height: integer("height").notNull(),
		/** ファイルサイズ(バイト) */
		fileSize: integer("file_size"),
		/** メディアの説明(ユーザー入力) */
		description: text("description"),
		/** ファイル作成日時 */
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		/** ファイル更新日時 */
		modifiedAt: integer("modified_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		/** DB登録日時 */
		indexedAt: integer("indexed_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		/** メディアの状態 */
		status: text("status", {
			enum: ["active", "archived", "deleted"],
		})
			.notNull()
			.default("active"),
	},
	(table) => ({
		mediaSourceIdFilePathUnique: unique("source_id_file_path_unique").on(
			table.mediaSourceId,
			table.filePath,
		),
		mediaSourceIdIndex: index("idx_media_source_id").on(table.mediaSourceId),
		fileSizeIndex: index("idx_media_file_size").on(table.fileSize),
		fileNameIndex: index("idx_media_file_name").on(table.fileName),
		createdAtIndex: index("idx_media_created_at").on(table.createdAt),
		descriptionIndex: index("idx_media_description").on(table.description),
	}),
);

/**
 * Schema for the tags table.
 * Stores information about tags used to categorize media.
 */
export const tags = sqliteTable(
	"tags",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
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
		/** 関連するAuthor ID */
		authorId: text("author_id").references(() => authors.id, {
			onDelete: "set null",
		}),
		/** 作成日時 */
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		/** 更新日時 */
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		nameUnique: unique("tags_name_unique").on(table.name),
		authorIdIndex: index("idx_tags_author_id").on(table.authorId),
	}),
);

/**
 * Schema for the media_tags join table.
 * Represents the many-to-many relationship between media items and tags.
 */
export const mediaTags = sqliteTable(
	"media_tags",
	{
		/** メディアID */
		mediaId: text("media_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** タグID */
		tagId: text("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
		/** タグのタイプ (positive/negative) */
		tagType: text("tag_type", { enum: ["positive", "negative"] })
			.notNull()
			.default("positive"),
		/** AIがタグを抽出した際の信頼度スコア (0.0-1.0)。手動の場合はNULL */
		confidence: real("confidence"),
		/** メディアへのタグ付与の起源 (manual, comfyui_workflow, tagger_program_Aなど) */
		source: text("source").notNull().default("manual"),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.mediaId, table.tagId, table.tagType] }),
		tagIdTagTypeMediaIdIndex: index(
			"idx_media_tags_tag_id_tag_type_media_id",
		).on(table.tagId, table.tagType, table.mediaId),
	}),
);

/**
 * Schema for the media_details table.
 * Stores additional, often user-generated, details about media items.
 */
export const mediaDetails = sqliteTable(
	"media_details",
	{
		/** メディアID */
		mediaId: text("media_id")
			.primaryKey()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** 評価 (0-5) */
		rating: integer("rating").default(0),
		/** お気に入り */
		favorite: integer("favorite", { mode: "boolean" }).default(false),
		/** 閲覧回数 */
		viewCount: integer("view_count").default(0),
		/** 最終閲覧日時 */
		lastViewedAt: integer("last_viewed_at", { mode: "timestamp_ms" }).default(
			new Date(0),
		),
	},
	(table) => ({
		ratingIndex: index("idx_media_details_rating").on(table.rating),
		favoriteIndex: index("idx_media_details_favorite").on(table.favorite),
		viewCountIndex: index("idx_media_details_view_count").on(table.viewCount),
	}),
);

/**
 * Schema for the media_generation_info table.
 * Stores information related to how a media item was generated, especially for AI-generated content.
 */
export const mediaGenerationInfo = sqliteTable(
	"media_generation_info",
	{
		/** メディアID */
		mediaId: text("media_id")
			.primaryKey()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** prompt, workflowなどのメタデータ */
		metadata: text("metadata", { mode: "json" }),
		/** プロンプト文字列 */
		prompt: text("prompt"),
		/** ネガティブプロンプト */
		negativePrompt: text("negative_prompt"),
		/** ComfyUIワークフロー全体 */
		workflow: text("workflow", { mode: "json" }),
		/** LoRA情報 [{"name": "...", "weight": 0.8}] */
		loras: text("loras", { mode: "json" }),
		/** VAE名 */
		vae: text("vae"),
		/** Hypernetwork情報 */
		hypernetworks: text("hypernetworks", { mode: "json" }),
		/** Embedding/Textual Inversion情報 */
		embeddings: text("embeddings", { mode: "json" }),
		/** AIによって生成されたかどうか */
		aiGenerated: integer("ai_generated", { mode: "boolean" }).default(false),
		/** 使用されたモデル名 */
		modelName: text("model_name").default(""),
		/** シード値 */
		seed: integer("seed").default(-1),
		/** CFGスケール */
		cfgScale: real("cfg_scale").default(0),
		/** ステップ数 */
		steps: integer("steps").default(0),
	},
	(table) => ({
		metadataIndex: index("idx_media_generation_info_metadata").on(
			table.metadata,
		),
		aiGeneratedIndex: index("idx_media_generation_info_ai_generated").on(
			table.aiGenerated,
		),
		modelNameIndex: index("idx_media_generation_info_model_name").on(
			table.modelName,
		),
	}),
);

/**
 * Schema for the categories table.
 * Organizes media into user-defined categories.
 */
export const categories = sqliteTable(
	"categories",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** カテゴリ名 */
		name: text("name").notNull(),
		/** カテゴリの説明 */
		description: text("description").default(""),
		/** UIで表示する際の色 */
		color: text("color").default("#808080"),
		/** 親カテゴリID */
		parentId: text("parent_id").references((): any => categories.id),
		/** 作成日時 */
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		/** カテゴリの起源 (manual) */
		source: text("source").notNull().default("manual"),
		/** 更新日時 */
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		nameUnique: unique("categories_name_unique").on(table.name),
	}),
);

/**
 * Schema for the projects table.
 * Stores information about projects that media items can be associated with.
 */
export const projects = sqliteTable(
	"projects",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** プロジェクト名 */
		name: text("name").notNull(),
		/** プロジェクトの説明 */
		description: text("description").default(""),
		/** 作成日時 */
		createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(
			() => new Date(),
		),
		/** 更新日時 */
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(
			() => new Date(),
		),
		/** アーカイブ日時 */
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
	},
	(table) => ({
		nameUnique: unique("projects_name_unique").on(table.name),
		nameIndex: index("idx_projects_name").on(table.name),
	}),
);

/**
 * Schema for the ips table.
 * Stores information about Intellectual Properties (IPs) that media items or characters can be associated with.
 */
export const ips = sqliteTable(
	"ips",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** IP(作品)名 */
		name: text("name").notNull(),
		/** IP(作品)の説明 */
		description: text("description").default(""),
		/** IPの起源 (manual, ai_generatedなど) */
		source: text("source").notNull().default("manual"),
		/** 作成日時 */
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		/** 更新日時 */
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		nameUnique: unique("ips_name_unique").on(table.name),
	}),
);

/**
 * Schema for the characters table.
 * Stores information about characters, potentially linked to IPs.
 */
export const characters = sqliteTable(
	"characters",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** キャラクター名 */
		name: text("name").notNull(),
		/** キャラクターの説明 */
		description: text("description").default(""),
		/** キャラクターの起源 (manual, ai_generatedなど) */
		source: text("source").notNull().default("manual"),
		/** キャラクターの別名（エイリアス）のリスト */
		aliases: text("aliases", { mode: "json" }),
		/** 作成日時 */
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		/** 更新日時 */
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		nameUnique: unique("characters_name_unique").on(table.name),
	}),
);

/**
 * Schema for the character_ips join table.
 * Represents the many-to-many relationship between characters and IPs.
 */
export const characterIps = sqliteTable(
	"character_ips",
	{
		/** キャラクターID */
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id, { onDelete: "cascade" }),
		/** IP(作品)ID */
		ipId: text("ip_id")
			.notNull()
			.references(() => ips.id, { onDelete: "cascade" }),
		/** 起源 (manual, ai_generatedなど) */
		source: text("source").notNull().default("manual"),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.characterId, table.ipId] }),
		ipIdCharacterIdIndex: index("idx_character_ips_ip_id_character_id").on(
			table.ipId,
			table.characterId,
		),
	}),
);

/**
 * Schema for the media_characters join table.
 * Represents the many-to-many relationship between media items and characters.
 */
export const mediaCharacters = sqliteTable(
	"media_characters",
	{
		/** メディアID */
		mediaId: text("media_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** キャラクターID */
		characterId: text("character_id")
			.notNull()
			.references(() => characters.id, { onDelete: "cascade" }),
		/** AIがキャラクターを抽出した際の信頼度スコア (0.0-1.0)。手動の場合はNULL */
		confidence: real("confidence"),
		/** メディアへのキャラクター付与 of 起源 (manual, ai_generatedなど) */
		source: text("source").notNull().default("manual"),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.mediaId, table.characterId] }),
		characterIdMediaIdIndex: index(
			"idx_media_characters_character_id_media_id",
		).on(table.characterId, table.mediaId),
	}),
);

/**
 * Schema for the media_categories join table.
 * Represents the many-to-many relationship between media items and categories.
 */
export const mediaCategories = sqliteTable(
	"media_categories",
	{
		/** メディアID */
		mediaId: text("media_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** カテゴリID */
		categoryId: text("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "cascade" }),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.mediaId, table.categoryId] }),
		categoryIdMediaIdIndex: index(
			"idx_media_categories_category_id_media_id",
		).on(table.categoryId, table.mediaId),
	}),
);

/**
 * Schema for the media_projects join table.
 * Represents the many-to-many relationship between media items and projects.
 */
export const mediaProjects = sqliteTable(
	"media_projects",
	{
		/** メディアID */
		mediaId: text("media_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** プロジェクトID */
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.mediaId, table.projectId] }),
		projectIdMediaIdIndex: index("idx_media_projects_project_id_media_id").on(
			table.projectId,
			table.mediaId,
		),
	}),
);

/**
 * Schema for the media_ips join table.
 * Represents the many-to-many relationship between media items and Intellectual Properties (IPs).
 */
export const mediaIps = sqliteTable(
	"media_ips",
	{
		/** メディアID */
		mediaId: text("media_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** IP(作品)ID */
		ipId: text("ip_id")
			.notNull()
			.references(() => ips.id, { onDelete: "cascade" }),
		/** AIがIPを抽出した際の信頼度スコア (0.0-1.0)。手動の場合はNULL */
		confidence: real("confidence"),
		/** メディアへのIP付与の起源 (manual, ai_generatedなど) */
		source: text("source").notNull().default("manual"),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.mediaId, table.ipId] }),
		ipIdMediaIdIndex: index("idx_media_ips_ip_id_media_id").on(
			table.ipId,
			table.mediaId,
		),
	}),
);

/**
 * Schema for the media_technical_info table.
 * Stores technical details about media files, such as color profiles, EXIF data, and video/audio codecs.
 */
export const mediaTechnicalInfo = sqliteTable(
	"media_technical_info",
	{
		/** メディアID */
		mediaId: text("media_id")
			.primaryKey()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** カラープロファイル */
		colorProfile: text("color_profile").default(""),
		/** EXIFデータ */
		exifData: text("exif_data", { mode: "json" }).default(sql`'{}'`),
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
	}),
);

/**
 * Schema for the media_sync table.
 * Manages synchronization and backup status for media items.
 */
export const mediaSync = sqliteTable("media_sync", {
	/** メディアID */
	mediaId: text("media_id")
		.primaryKey()
		.references(() => medias.id, { onDelete: "cascade" }),
	/** 同期ステータス */
	syncStatus: text("sync_status", {
		enum: ["synced", "pending", "failed"],
	}).default("synced"),
	/** バックアップURL */
	backupUrls: text("backup_urls", { mode: "json" })
		.$type<string[]>()
		.default(sql`'[]'`),
	/** 最後の同期日時 */
	lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
	/** 同期試行回数 */
	syncAttempts: integer("sync_attempts").default(0),
	/** 最後のエラーメッセージ */
	lastError: text("last_error"),
});

/**
 * Schema for the view_history table.
 * Records user views of media items for analytics and personalized recommendations.
 */
export const viewHistory = sqliteTable("view_history", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** メディアID */
	mediaId: text("media_id")
		.notNull()
		.references(() => medias.id, { onDelete: "cascade" }),
	/** 閲覧日時 */
	viewedAt: integer("viewed_at", { mode: "timestamp_ms" }).$defaultFn(
		() => new Date(),
	),
	/** IPアドレス */
	ipAddress: text("ip_address"),
	/** ユーザーエージェント */
	userAgent: text("user_agent").default(""),
});

/**
 * Schema for the similar_media table.
 * Stores relationships between similar media items, often determined by perceptual hashing.
 */
export const similarMedia = sqliteTable(
	"similar_media",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** メディア1のID */
		media1Id: text("media1_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** メディア2のID */
		media2Id: text("media2_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** 類似度スコア */
		similarityScore: real("similarity_score").default(0),
		/** 類似度計算アルゴリズム */
		algorithm: text("algorithm").default("perceptual"),
		/** 作成日時 */
		createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(
			() => new Date(),
		),
	},
	(table) => ({
		media1IdMedia2IdAlgorithmUnique: unique(
			"media1Id_media2Id_algorithm_unique",
		).on(table.media1Id, table.media2Id, table.algorithm),
		similarityScoreIndex: index("idx_similar_media_score").on(
			table.similarityScore,
		),
	}),
);

/**
 * Schema for the media_relations table.
 * Manages relationships between media items, such as variants, versions, or pages in a series.
 */
export const mediaRelationsTable = sqliteTable(
	"media_relations",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** 親メディアID */
		parentMediaId: text("parent_media_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** 子メディアID */
		childMediaId: text("child_media_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** 関係の種類 */
		relationType: text("relation_type", {
			enum: ["variant", "version", "page", "derivative", "edit", "source"],
		}).notNull(),
		/** ページ番号等の順序（オプショナル） */
		orderIndex: integer("order_index"),
		/** 追加情報（差分内容の説明等）をJSON形式で保存 */
		metadata: text("metadata", { mode: "json" }),
		/** 作成日時 */
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		parentChildTypeUnique: unique("parent_child_type_unique").on(
			table.parentMediaId,
			table.childMediaId,
			table.relationType,
		),
		childMediaIdIndex: index("idx_media_relations_child").on(
			table.childMediaId,
		),
		relationTypeIndex: index("idx_media_relations_type").on(table.relationType),
	}),
);

/**
 * Schema for the authors table.
 * Stores information about authors/artists.
 */
export const authors = sqliteTable(
	"authors",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** 表示名 */
		name: text("name").notNull(),
		/** 外部ID (例: Twitter ID, Pixiv ID) */
		accountId: text("account_id"),
		/** 作成日時 */
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		/** 更新日時 */
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		accountIdIndex: index("idx_authors_account_id").on(table.accountId),
		nameIndex: index("idx_authors_name").on(table.name),
	}),
);

/**
 * Schema for the media_authors join table.
 * Many-to-many relationship between media and authors.
 */
export const mediaAuthors = sqliteTable(
	"media_authors",
	{
		mediaId: text("media_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		authorId: text("author_id")
			.notNull()
			.references(() => authors.id, { onDelete: "cascade" }),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.mediaId, table.authorId] }),
		authorIdMediaIdIndex: index("idx_media_authors_author_id_media_id").on(
			table.authorId,
			table.mediaId,
		),
	}),
);

/**
 * Schema for the media_urls table.
 * Stores multiple source URLs for a media item.
 */
export const mediaUrls = sqliteTable(
	"media_urls",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		mediaId: text("media_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		url: text("url").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		mediaIdIndex: index("idx_media_urls_media_id").on(table.mediaId),
		urlIndex: index("idx_media_urls_url").on(table.url),
		mediaIdUrlUnique: uniqueIndex("idx_media_urls_media_id_url_unique").on(
			table.mediaId,
			table.url,
		),
	}),
);

/**
 * Schema for the users table.
 * Stores user account information.
 */
export const users = sqliteTable(
	"users",
	{
		/** ユーザーID */
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** ユーザー名 */
		name: text("name").notNull(),
		/** メールアドレス */
		email: text("email").notNull(),
		/** パスワード */
		password: text("password").notNull(),
		/** 作成日時 */
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
		/** 更新日時 */
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		emailUnique: unique("users_email_unique").on(table.email),
	}),
);

/**
 * Schema for the collections table.
 * Stores user-created collections of media items.
 */
export const collections = sqliteTable("collections", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** どのユーザーのコレクションか (ユーザー管理を導入する場合) */
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	/** コレクション名 */
	name: text("name").notNull(),
	/** コレクションの説明 */
	description: text("description").default(""),
	/** 作成日時 */
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
	/** 更新日時 */
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
});

/**
 * Schema for the media_collections join table.
 * Represents the many-to-many relationship between collections and media items.
 */
export const mediaCollections = sqliteTable(
	"media_collections",
	{
		/** コレクションID */
		collectionId: text("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		/** メディアID */
		mediaId: text("media_id")
			.notNull()
			.references(() => medias.id, { onDelete: "cascade" }),
		/** コレクション内での表示順序 */
		displayOrder: integer("display_order"),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.collectionId, table.mediaId] }),
		mediaIdIndex: index("idx_media_collections_media_id").on(table.mediaId),
	}),
);

/**
 * Schema for the jobs table.
 * Manages background jobs such as thumbnail generation, metadata extraction, and bulk tagging.
 * It tracks their progress and results.
 */
export const jobs = sqliteTable("jobs", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	/** ジョブの種類 (例: "thumbnail_generation", "metadata_extraction", "auto_tagging") */
	type: text("type").notNull(),
	/** 関連するメディアソースID (オプショナル) */
	mediaSourceId: text("source_id").references(() => mediaSources.id, {
		onDelete: "cascade",
	}),
	/** ジョブのステータス */
	status: text("status", {
		enum: ["pending", "in_progress", "completed", "failed"],
	})
		.notNull()
		.default("pending"),
	/** ジョブの入力パラメータ (JSON) */
	payload: text("payload", { mode: "json" }),
	/** ジョブの実行結果 (JSON) */
	result: text("result", { mode: "json" }),
	/** エラーメッセージ (失敗時) */
	error: text("error"),
	/** ジョブ作成日時 */
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
	/** 最終更新日時 */
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
	/** 親ジョブID (バッチ処理用) */
	parentId: text("parent_id").references((): any => jobs.id, {
		onDelete: "cascade",
	}),
});

/**
 * Schema for the presets table.
 * Stores user-defined filter presets for searching media.
 */
export const presets = sqliteTable("presets", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	/** プリセット名 (例: "お気に入りの高評価画像", "2024年の青い目キャラクター") */
	name: text("name").notNull().unique(),
	/** フィルター条件をJSON形式で保存 */
	value: text("value", { mode: "json" }).notNull(),
	/** ソート項目 */
	sort: text("sort"),
	/** ソート順 */
	order: text("order"),
	/** 検索モード ("simple" または "pro") */
	mode: text("mode"),
	/** 作成日時 */
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const appConfig = sqliteTable("app_config", {
	id: integer("id").primaryKey(),
	value: text("value", { mode: "json" }).$type<AppConfig>().notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.$defaultFn(() => new Date()),
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
		fields: [medias.mediaSourceId],
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
	/** メディアのSource URLリスト */
	urls: many(mediaUrls),
	/** メディアのAuthorリスト */
	authors: many(mediaAuthors),
}));

/**
 * Defines the relations for the tags table.
 */
export const tagsRelations = relations(tags, ({ one, many }) => ({
	/** タグが付与されたメディア */
	media: many(mediaTags),
	/** タグに関連するAuthor */
	author: one(authors, {
		fields: [tags.authorId],
		references: [authors.id],
	}),
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
	/** IPに属するキャラクター (中間テーブル経由) */
	characters: many(characterIps),
}));

/**
 * Defines the relations for the characters table.
 */
export const charactersRelations = relations(characters, ({ many }) => ({
	/** キャラクターが属するIP (中間テーブル経由) */
	ips: many(characterIps),
	/** キャラクターが含まれるメディア */
	media: many(mediaCharacters),
}));

/**
 * Defines the relations for the character_ips join table.
 */
export const characterIpsRelations = relations(characterIps, ({ one }) => ({
	/** 中間テーブルが参照するキャラクター */
	character: one(characters, {
		fields: [characterIps.characterId],
		references: [characters.id],
	}),
	/** 中間テーブルが参照するIP */
	ip: one(ips, {
		fields: [characterIps.ipId],
		references: [ips.id],
	}),
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
	}),
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
	}),
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
	}),
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
	}),
);

/**
 * Defines the relations for the authors table.
 */
export const authorsRelations = relations(authors, ({ many }) => ({
	/** Authorに関連するメディア */
	media: many(mediaAuthors),
	/** Authorに関連するタグ */
	tags: many(tags),
}));

/**
 * Defines the relations for the media_authors join table.
 */
export const mediaAuthorsRelations = relations(mediaAuthors, ({ one }) => ({
	/** 中間テーブルが参照するメディア */
	media: one(medias, {
		fields: [mediaAuthors.mediaId],
		references: [medias.id],
	}),
	/** 中間テーブルが参照するAuthor */
	author: one(authors, {
		fields: [mediaAuthors.authorId],
		references: [authors.id],
	}),
}));

/**
 * Defines the relations for the media_urls table.
 */
export const mediaUrlsRelations = relations(mediaUrls, ({ one }) => ({
	/** URLが属するメディア */
	media: one(medias, {
		fields: [mediaUrls.mediaId],
		references: [medias.id],
	}),
}));

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
export type NewMedia = InferInsertModel<typeof medias>;

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
 * Type definition for selecting a character IP relationship from the database.
 */
export type CharacterIp = InferSelectModel<typeof characterIps>;
/**
 * Type definition for inserting a new character IP relationship into the database.
 */
export type NewCharacterIp = InferInsertModel<typeof characterIps>;

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
 * Type definition for selecting the singleton app config row.
 */
export type AppConfigRecord = InferSelectModel<typeof appConfig>;
/**
 * Type definition for inserting the singleton app config row.
 */
export type NewAppConfigRecord = InferInsertModel<typeof appConfig>;

/**
 * Type definition for selecting a media relation from the database.
 */
export type MediaRelation = InferSelectModel<typeof mediaRelationsTable>;
/**
 * Type definition for inserting a new media relation into the database.
 */
export type NewMediaRelation = InferInsertModel<typeof mediaRelationsTable>;

/**
 * Type definition for selecting an author from the database.
 */
export type Author = InferSelectModel<typeof authors>;
/**
 * Type definition for inserting a new author into the database.
 */
export type NewAuthor = InferInsertModel<typeof authors>;

/**
 * Type definition for selecting a media author relationship from the database.
 */
export type MediaAuthor = InferSelectModel<typeof mediaAuthors>;
/**
 * Type definition for inserting a new media author relationship into the database.
 */
export type NewMediaAuthor = InferInsertModel<typeof mediaAuthors>;

/**
 * Type definition for selecting a media url from the database.
 */
export type MediaUrl = InferSelectModel<typeof mediaUrls>;
/**
 * Type definition for inserting a new media url into the database.
 */
export type NewMediaUrl = InferInsertModel<typeof mediaUrls>;
