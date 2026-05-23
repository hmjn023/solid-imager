CREATE TABLE IF NOT EXISTS `app_config` (
  `id` TEXT NOT NULL,
  `value` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS `authors` (
  `id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `account_id` TEXT,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS `categories` (
  `id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT DEFAULT '',
  `color` TEXT DEFAULT '#808080',
  `parent_id` TEXT,
  `created_at` TEXT NOT NULL,
  `source` TEXT NOT NULL DEFAULT 'manual',
  `updated_at` TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `categories_name_unique` ON `categories` (`name`);

CREATE TABLE IF NOT EXISTS `character_ips` (
  `character_id` TEXT NOT NULL,
  `ip_id` TEXT NOT NULL,
  `source` TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS `characters` (
  `id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT DEFAULT '',
  `source` TEXT NOT NULL DEFAULT 'manual',
  `aliases` TEXT,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `characters_name_unique` ON `characters` (`name`);

CREATE TABLE IF NOT EXISTS `collections` (
  `id` TEXT NOT NULL,
  `user_id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT DEFAULT '',
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS `ips` (
  `id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT DEFAULT '',
  `source` TEXT NOT NULL DEFAULT 'manual',
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `ips_name_unique` ON `ips` (`name`);

CREATE TABLE IF NOT EXISTS `jobs` (
  `id` TEXT NOT NULL,
  `type` TEXT NOT NULL,
  `source_id` TEXT,
  `status` TEXT NOT NULL DEFAULT 'pending',
  `payload` TEXT,
  `result` TEXT,
  `error` TEXT,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL,
  `parent_id` TEXT
);

CREATE TABLE IF NOT EXISTS `media_authors` (
  `media_id` TEXT NOT NULL,
  `author_id` TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS `media_categories` (
  `media_id` TEXT NOT NULL,
  `category_id` TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS `media_characters` (
  `media_id` TEXT NOT NULL,
  `character_id` TEXT NOT NULL,
  `confidence` TEXT,
  `source` TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS `media_collections` (
  `collection_id` TEXT NOT NULL,
  `media_id` TEXT NOT NULL,
  `display_order` TEXT
);

CREATE TABLE IF NOT EXISTS `media_details` (
  `media_id` TEXT NOT NULL,
  `rating` TEXT DEFAULT 0,
  `favorite` TEXT DEFAULT 'false',
  `view_count` TEXT DEFAULT 0,
  `last_viewed_at` TEXT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `media_generation_info` (
  `media_id` TEXT NOT NULL,
  `metadata` TEXT,
  `prompt` TEXT,
  `negative_prompt` TEXT,
  `workflow` TEXT,
  `loras` TEXT,
  `vae` TEXT,
  `hypernetworks` TEXT,
  `embeddings` TEXT,
  `ai_generated` TEXT DEFAULT 'false',
  `model_name` TEXT DEFAULT '',
  `seed` TEXT DEFAULT -1,
  `cfg_scale` TEXT DEFAULT 0,
  `steps` TEXT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `media_ips` (
  `media_id` TEXT NOT NULL,
  `ip_id` TEXT NOT NULL,
  `confidence` TEXT,
  `source` TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS `media_projects` (
  `media_id` TEXT NOT NULL,
  `project_id` TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS `media_relations` (
  `id` TEXT NOT NULL,
  `parent_media_id` TEXT NOT NULL,
  `child_media_id` TEXT NOT NULL,
  `relation_type` TEXT NOT NULL,
  `order_index` TEXT,
  `metadata` TEXT,
  `created_at` TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `parent_child_type_unique` ON `media_relations` (`parent_media_id`, `child_media_id`, `relation_type`);

CREATE TABLE IF NOT EXISTS `media_sources` (
  `id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT,
  `type` TEXT NOT NULL,
  `connection_info` TEXT NOT NULL,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS `media_sync` (
  `media_id` TEXT NOT NULL,
  `sync_status` TEXT DEFAULT 'synced',
  `backup_urls` TEXT,
  `last_synced_at` TEXT,
  `sync_attempts` TEXT DEFAULT 0,
  `last_error` TEXT
);

CREATE TABLE IF NOT EXISTS `media_tags` (
  `media_id` TEXT NOT NULL,
  `tag_id` TEXT NOT NULL,
  `tag_type` TEXT NOT NULL DEFAULT 'positive',
  `confidence` TEXT,
  `source` TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS `media_technical_info` (
  `media_id` TEXT NOT NULL,
  `color_profile` TEXT DEFAULT '',
  `exif_data` TEXT,
  `hash_md5` TEXT DEFAULT '',
  `hash_perceptual` TEXT DEFAULT '',
  `duration_seconds` TEXT,
  `frame_rate` TEXT,
  `bitrate_kbps` TEXT,
  `video_codec` TEXT,
  `audio_codec` TEXT
);

CREATE TABLE IF NOT EXISTS `media_urls` (
  `id` TEXT NOT NULL,
  `media_id` TEXT NOT NULL,
  `url` TEXT NOT NULL,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS `media` (
  `id` TEXT NOT NULL,
  `source_id` TEXT NOT NULL,
  `file_path` TEXT NOT NULL,
  `file_name` TEXT NOT NULL,
  `media_type` TEXT NOT NULL,
  `width` TEXT NOT NULL,
  `height` TEXT NOT NULL,
  `file_size` TEXT,
  `description` TEXT,
  `created_at` TEXT NOT NULL,
  `modified_at` TEXT NOT NULL,
  `indexed_at` TEXT NOT NULL,
  `status` TEXT NOT NULL DEFAULT 'active'
);

CREATE UNIQUE INDEX IF NOT EXISTS `source_id_file_path_unique` ON `media` (`source_id`, `file_path`);

CREATE TABLE IF NOT EXISTS `presets` (
  `id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `value` TEXT NOT NULL,
  `sort` TEXT,
  `order` TEXT,
  `mode` TEXT,
  `created_at` TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS `projects` (
  `id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT DEFAULT '',
  `created_at` TEXT,
  `updated_at` TEXT,
  `archived_at` TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS `projects_name_unique` ON `projects` (`name`);

CREATE TABLE IF NOT EXISTS `similar_media` (
  `id` TEXT NOT NULL,
  `media1_id` TEXT NOT NULL,
  `media2_id` TEXT NOT NULL,
  `similarity_score` TEXT DEFAULT 0,
  `algorithm` TEXT DEFAULT 'perceptual',
  `created_at` TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS `media1Id_media2Id_algorithm_unique` ON `similar_media` (`media1_id`, `media2_id`, `algorithm`);

CREATE TABLE IF NOT EXISTS `tags` (
  `id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT,
  `attribute` TEXT,
  `color` TEXT,
  `source` TEXT NOT NULL DEFAULT 'manual',
  `author_id` TEXT,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `tags_name_unique` ON `tags` (`name`);

CREATE TABLE IF NOT EXISTS `users` (
  `id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `email` TEXT NOT NULL,
  `password` TEXT NOT NULL,
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);

CREATE TABLE IF NOT EXISTS `view_history` (
  `id` TEXT NOT NULL,
  `media_id` TEXT NOT NULL,
  `viewed_at` TEXT,
  `ip_address` TEXT,
  `user_agent` TEXT DEFAULT ''
);
