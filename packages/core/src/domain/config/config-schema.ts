import { z } from "zod";

const DEFAULT_JOBS_CONCURRENCY = 3;
const DEFAULT_JOBS_POLL_INTERVAL = 1000;
const MIN_JOBS_CONCURRENCY = 1;
const MIN_JOBS_POLL_INTERVAL = 100;
const DEFAULT_AUTO_TAGGING = false;

export const JobsConfigSchema = z.object({
  concurrency: z
    .number()
    .min(MIN_JOBS_CONCURRENCY)
    .default(DEFAULT_JOBS_CONCURRENCY),
  aiConcurrency: z.number().min(MIN_JOBS_CONCURRENCY).default(1),
  pollIntervalMs: z
    .number()
    .min(MIN_JOBS_POLL_INTERVAL)
    .default(DEFAULT_JOBS_POLL_INTERVAL),
  enableAutoTagging: z.boolean().default(DEFAULT_AUTO_TAGGING),
});
const defaultJobsConfig = JobsConfigSchema.parse({});

const DEFAULT_AI_BASE_URL = "http://localhost:8000";
const DEFAULT_AI_TIMEOUT = 120_000;
const MIN_AI_TIMEOUT = 1000;

export const AiConfigSchema = z.object({
  baseUrl: z.string().default(DEFAULT_AI_BASE_URL),
  timeoutMs: z.number().min(MIN_AI_TIMEOUT).default(DEFAULT_AI_TIMEOUT),
});
const defaultAiConfig = AiConfigSchema.parse({});

const DEFAULT_THUMB_DIR = ".cache/thumbnails";
const DEFAULT_THUMB_SIZE = 512;
const DEFAULT_THUMB_QUALITY = 80;
const MIN_THUMB_SIZE = 64;
const MAX_THUMB_SIZE = 4096;
const MIN_THUMB_QUALITY = 1;
const MAX_THUMB_QUALITY = 100;

export const StorageConfigSchema = z.object({
  thumbnailDir: z.string().default(DEFAULT_THUMB_DIR),
  thumbnailSize: z
    .number()
    .min(MIN_THUMB_SIZE)
    .max(MAX_THUMB_SIZE)
    .default(DEFAULT_THUMB_SIZE),
  thumbnailQuality: z
    .number()
    .min(MIN_THUMB_QUALITY)
    .max(MAX_THUMB_QUALITY)
    .default(DEFAULT_THUMB_QUALITY),
});
const defaultStorageConfig = StorageConfigSchema.parse({});

export const ComfyUiTagExtractionSchema = z.object({
  positiveNodeTypes: z
    .array(z.string())
    .default(["CLIPTextEncode", "CR Combine Prompt"]),
  negativeKeywords: z.array(z.string()).default(["negative"]),
  negativeTags: z.array(z.string()).default(["lowres"]),
});
const defaultComfyUiTagExtraction = ComfyUiTagExtractionSchema.parse({});

export const TagExtractionConfigSchema = z.object({
  comfyui: ComfyUiTagExtractionSchema.default(defaultComfyUiTagExtraction),
});
const defaultTagExtractionConfig = TagExtractionConfigSchema.parse({});

const DEFAULT_EXTENSIONS = {
  image: [".jpg", ".jpeg", ".png", ".webp"],
  video: [".mp4", ".webm", ".mov"],
  audio: [".mp3", ".wav"],
};

export const MediaConfigSchema = z.object({
  supportedExtensions: z
    .object({
      image: z.array(z.string()).default(DEFAULT_EXTENSIONS.image),
      video: z.array(z.string()).default(DEFAULT_EXTENSIONS.video),
      audio: z.array(z.string()).default(DEFAULT_EXTENSIONS.audio),
    })
    .default(DEFAULT_EXTENSIONS),
  tagExtraction: TagExtractionConfigSchema.default(defaultTagExtractionConfig),
});
const defaultMediaConfig = MediaConfigSchema.parse({});

export const LoggingConfigSchema = z.object({
  level: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});
const defaultLoggingConfig = LoggingConfigSchema.parse({});

export const SyncServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url("Invalid URL format"),
  apiKey: z.string().optional(),
});

export type SyncServer = z.infer<typeof SyncServerSchema>;

export const SyncConfigSchema = z.object({
  servers: z.array(SyncServerSchema).default([]),
});
const defaultSyncConfig = SyncConfigSchema.parse({});

export const AppConfigSchema = z.object({
  version: z.string().default("1.0.0"),
  jobs: JobsConfigSchema.default(defaultJobsConfig),
  ai: AiConfigSchema.default(defaultAiConfig),
  storage: StorageConfigSchema.default(defaultStorageConfig),
  media: MediaConfigSchema.default(defaultMediaConfig),
  logging: LoggingConfigSchema.default(defaultLoggingConfig),
  sync: SyncConfigSchema.default(defaultSyncConfig),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export const defaultAppConfig = AppConfigSchema.parse({});
