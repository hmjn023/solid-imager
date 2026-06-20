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

const DEFAULT_JOBS_CONFIG = {
	concurrency: DEFAULT_JOBS_CONCURRENCY,
	aiConcurrency: 1,
	pollIntervalMs: DEFAULT_JOBS_POLL_INTERVAL,
	enableAutoTagging: DEFAULT_AUTO_TAGGING,
} as const;

const DEFAULT_AI_BASE_URL = "";
const DEFAULT_AI_TIMEOUT = 120_000;
const MIN_AI_TIMEOUT = 1000;

export const AiConfigSchema = z.object({
	baseUrl: z.string().default(DEFAULT_AI_BASE_URL),
	timeoutMs: z.number().min(MIN_AI_TIMEOUT).default(DEFAULT_AI_TIMEOUT),
});

const DEFAULT_AI_CONFIG = {
	baseUrl: DEFAULT_AI_BASE_URL,
	timeoutMs: DEFAULT_AI_TIMEOUT,
} as const;

const DEFAULT_DOWNLOAD_RATE_LIMIT_ENABLED = true;
const DEFAULT_DOWNLOAD_REQUEST_INTERVAL_MS = 1_000;
const MAX_DOWNLOAD_REQUEST_INTERVAL_MS = 60_000;

export const DownloadsConfigSchema = z.object({
	rateLimitEnabled: z.boolean().default(DEFAULT_DOWNLOAD_RATE_LIMIT_ENABLED),
	requestIntervalMs: z
		.number()
		.min(0)
		.max(MAX_DOWNLOAD_REQUEST_INTERVAL_MS)
		.default(DEFAULT_DOWNLOAD_REQUEST_INTERVAL_MS),
});

const DEFAULT_DOWNLOADS_CONFIG = {
	rateLimitEnabled: DEFAULT_DOWNLOAD_RATE_LIMIT_ENABLED,
	requestIntervalMs: DEFAULT_DOWNLOAD_REQUEST_INTERVAL_MS,
} as const;

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

const DEFAULT_STORAGE_CONFIG = {
	thumbnailDir: DEFAULT_THUMB_DIR,
	thumbnailSize: DEFAULT_THUMB_SIZE,
	thumbnailQuality: DEFAULT_THUMB_QUALITY,
} as const;

export const ComfyUiTagExtractionSchema = z.object({
	positiveNodeTypes: z
		.array(z.string())
		.default(["CLIPTextEncode", "CR Combine Prompt"]),
	negativeKeywords: z.array(z.string()).default(["negative"]),
	negativeTags: z.array(z.string()).default(["lowres"]),
});

const DEFAULT_COMFYUI_TAG_EXTRACTION = {
	positiveNodeTypes: ["CLIPTextEncode", "CR Combine Prompt"],
	negativeKeywords: ["negative"],
	negativeTags: ["lowres"],
};

export const TagExtractionConfigSchema = z.object({
	comfyui: ComfyUiTagExtractionSchema.default(DEFAULT_COMFYUI_TAG_EXTRACTION),
});

const DEFAULT_EXTENSIONS = {
	image: [".jpg", ".jpeg", ".png", ".webp"],
	video: [".mp4", ".webm", ".mov"],
	audio: [".mp3", ".wav"],
};

const DEFAULT_TAG_EXTRACTION_CONFIG = {
	comfyui: DEFAULT_COMFYUI_TAG_EXTRACTION,
};

export const MediaConfigSchema = z.object({
	supportedExtensions: z
		.object({
			image: z.array(z.string()).default(DEFAULT_EXTENSIONS.image),
			video: z.array(z.string()).default(DEFAULT_EXTENSIONS.video),
			audio: z.array(z.string()).default(DEFAULT_EXTENSIONS.audio),
		})
		.default(DEFAULT_EXTENSIONS),
	tagExtraction: TagExtractionConfigSchema.default(
		DEFAULT_TAG_EXTRACTION_CONFIG,
	),
});

const DEFAULT_MEDIA_CONFIG = {
	supportedExtensions: {
		image: DEFAULT_EXTENSIONS.image,
		video: DEFAULT_EXTENSIONS.video,
		audio: DEFAULT_EXTENSIONS.audio,
	},
	tagExtraction: {
		comfyui: DEFAULT_COMFYUI_TAG_EXTRACTION,
	},
};

export const LoggingConfigSchema = z.object({
	level: z
		.enum(["trace", "debug", "info", "warn", "error", "fatal"])
		.default("info"),
});

const DEFAULT_LOGGING_CONFIG = {
	level: "info",
} as const;

export const LanceDbConfigSchema = z.object({
	autoFullSync: z.boolean().default(true),
	cacheDir: z.string().default(".cache/lancedb-cache"),
});

const DEFAULT_LANCEDB_CONFIG = {
	autoFullSync: true,
	cacheDir: ".cache/lancedb-cache",
} as const;

export const AppConfigSchema = z.object({
	version: z.string().default("1.0.0"),
	jobs: JobsConfigSchema.default(DEFAULT_JOBS_CONFIG),
	ai: AiConfigSchema.default(DEFAULT_AI_CONFIG),
	downloads: DownloadsConfigSchema.default(DEFAULT_DOWNLOADS_CONFIG),
	storage: StorageConfigSchema.default(DEFAULT_STORAGE_CONFIG),
	media: MediaConfigSchema.default(DEFAULT_MEDIA_CONFIG),
	logging: LoggingConfigSchema.default(DEFAULT_LOGGING_CONFIG),
	lancedb: LanceDbConfigSchema.default(DEFAULT_LANCEDB_CONFIG),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export const defaultAppConfig = AppConfigSchema.parse({});
