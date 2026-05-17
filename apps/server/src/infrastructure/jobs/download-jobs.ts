/**
 * Download Jobs - Handles downloading images from URLs
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
	AddMediaRequest,
	DownloadItem,
} from "@solid-imager/core/domain/media/schemas";
import { generateMediaFilename } from "@solid-imager/core/domain/media/utils/filename-utils";
import { getMediaTypeFromExtension } from "@solid-imager/core/domain/media/utils/media-type-utils";
import { create as createYtDlp } from "youtube-dl-exec";
import { services } from "~/application/registry";
import type { Job } from "~/infrastructure/db/schema";
import { waitForDownloadRateLimit } from "~/infrastructure/jobs/download-rate-limiter";
import { SseManager } from "~/infrastructure/jobs/sse-manager";
import { logger } from "~/infrastructure/logger";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";
import { resolveFfmpegPath } from "~/infrastructure/utils/ffmpeg";

const DATE_REGEX = /(\d{4})(\d{2})(\d{2})/;
const TWITTER_URL_REGEX = /(twitter|x)\.com\/\w+\/status\/\d+/;

let ytDlpPathCache: string | null = null;
let ytDlpResolvePromise: Promise<string> | null = null;

async function resolveYtDlpPath(): Promise<string> {
	if (ytDlpResolvePromise) return ytDlpResolvePromise;

	ytDlpResolvePromise = (async () => {
		if (ytDlpPathCache) return ytDlpPathCache;

		const { existsSync } = await import("node:fs");

		// 1. Check built output location first (for production builds)
		const outputBin = path.join(process.cwd(), "yt-dlp");
		if (existsSync(outputBin)) {
			ytDlpPathCache = outputBin;
			return ytDlpPathCache;
		}

		// 2. Check node_modules in current working directory
		const nodeModulesBin = path.join(
			process.cwd(),
			"node_modules/youtube-dl-exec/bin/yt-dlp",
		);
		if (existsSync(nodeModulesBin)) {
			ytDlpPathCache = nodeModulesBin;
			return ytDlpPathCache;
		}

		// 3. Walk up from current file to find workspace root
		const { fileURLToPath } = await import("node:url");
		const { dirname } = await import("node:path");
		let dir = dirname(fileURLToPath(new URL(import.meta.url)));
		for (let i = 0; i < 10; i++) {
			const candidate = path.join(
				dir,
				"node_modules/youtube-dl-exec/bin/yt-dlp",
			);
			if (existsSync(candidate)) {
				ytDlpPathCache = candidate;
				return ytDlpPathCache;
			}
			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}

		// 4. Fallback to PATH
		ytDlpPathCache = "yt-dlp";
		return ytDlpPathCache;
	})();

	return ytDlpResolvePromise;
}

type YtDlpOutput = {
	id: string;

	title: string;
	description: string;
	duration?: number;
	width?: number;
	height?: number;
	ext: string;
	uploader?: string;

	uploader_id?: string;

	upload_date?: string;
	_filename?: string;
	filename: string;
};

type Cookie = any;

async function createNetscapeCookieFile(
	cookies: Cookie[],
): Promise<string | null> {
	if (!Array.isArray(cookies) || cookies.length === 0) {
		return null;
	}

	const randomSuffix = Math.random().toString(36).slice(2);
	const cookieFilePath = path.join(
		os.tmpdir(),
		`cookies-${Date.now()}-${randomSuffix}.txt`,
	);

	try {
		const lines = ["# Netscape HTTP Cookie File"];

		for (const cookie of cookies) {
			const domain = cookie.domain;
			const flag = domain.startsWith(".") ? "TRUE" : "FALSE";
			const cookiePath = cookie.path;
			const secure = cookie.secure ? "TRUE" : "FALSE";
			const expiration = cookie.expirationDate
				? Math.floor(cookie.expirationDate)
				: 0;
			const name = cookie.name;
			const value = cookie.value;

			lines.push(
				`${domain}\t${flag}\t${cookiePath}\t${secure}\t${expiration}\t${name}\t${value}`,
			);
		}

		await fs.writeFile(cookieFilePath, lines.join("\n"));
		return cookieFilePath;
	} catch (e) {
		logger.warn({ err: e }, "Failed to create cookie file");
		return null;
	}
}

/**
 * Downloads video/media using yt-dlp via youtube-dl-exec
 */
async function downloadWithYtDlp(
	url: string,
	outputDir: string,
	cookies?: Cookie[],
	userAgent?: string,
): Promise<{ filePath: string; metadata: YtDlpOutput }[]> {
	await fs.mkdir(outputDir, { recursive: true });

	const template = "%(id)s.%(ext)s";
	const cookieFilePath = await createNetscapeCookieFile(cookies || []);

	try {
		const ffmpegLocation = await resolveFfmpegPath();
		const ytDlpPath = await resolveYtDlpPath();
		const ytdlp = createYtDlp(ytDlpPath);
		const result = await ytdlp(url, {
			noSimulate: true,
			printJson: true,
			paths: outputDir,
			output: template,
			format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
			mergeOutputFormat: "mp4",
			...(ffmpegLocation && { ffmpegLocation }),
			...(userAgent && { userAgent }),
			...(cookieFilePath && { cookies: cookieFilePath }),
		} as any);

		// output handling
		const outputs = parseYtDlpOutput(result);

		return outputs.map((metadata) => {
			let finalPath = metadata.filename || metadata._filename || "";
			if (finalPath && !path.isAbsolute(finalPath)) {
				finalPath = path.join(outputDir, finalPath);
			}
			return { filePath: finalPath, metadata };
		});
	} catch (error) {
		// youtube-dl-exec errors include stderr
		if (error instanceof Error && "stderr" in error) {
			logger.error(
				{ stderr: (error as Error & { stderr: string }).stderr },
				"yt-dlp execution failed",
			);
		} else {
			logger.error({ err: error }, "yt-dlp execution failed");
		}
		const msg = error instanceof Error ? error.message : String(error);
		throw new Error(`yt-dlp failed: ${msg}`);
	} finally {
		if (cookieFilePath) {
			fs.unlink(cookieFilePath).catch((err) =>
				logger.warn({ err }, "Failed to clean up cookie file"),
			);
		}
	}
}

function parseYtDlpOutput(result: unknown): YtDlpOutput[] {
	let outputs: YtDlpOutput[] = [];

	if (typeof result === "string") {
		const lines = (result as string)
			.split("\n")
			.filter((line) => line.trim().length > 0);
		outputs = lines.reduce<YtDlpOutput[]>((acc, line) => {
			try {
				acc.push(JSON.parse(line));
			} catch (e) {
				logger.warn({ err: e, line }, "Failed to parse yt-dlp JSON line");
			}
			return acc;
		}, []);
	} else if (Array.isArray(result)) {
		outputs = result as unknown as YtDlpOutput[];
	} else if (typeof result === "object" && result !== null) {
		outputs = [result as unknown as YtDlpOutput];
	} else {
		logger.warn(
			{ resultType: typeof result, result },
			"Unexpected yt-dlp output type",
		);
		throw new Error(`Unexpected yt-dlp output type: ${typeof result}`);
	}
	return outputs;
}

/**
 * Fetches metadata using yt-dlp without downloading the file.
 */
async function fetchMetadataWithYtDlp(
	url: string,
	cookies?: Cookie[],
	userAgent?: string,
): Promise<YtDlpOutput | null> {
	const cookieFilePath = await createNetscapeCookieFile(cookies || []);

	try {
		const ffmpegLocation = await resolveFfmpegPath();
		const ytDlpPath = await resolveYtDlpPath();
		const ytdlp = createYtDlp(ytDlpPath);
		const result = await ytdlp(url, {
			dumpSingleJson: true,
			noDownload: true,
			...(ffmpegLocation && { ffmpegLocation }),
			...(userAgent && { userAgent }),
			...(cookieFilePath && { cookies: cookieFilePath }),
		} as any);

		return result as unknown as YtDlpOutput;
	} catch (error) {
		logger.warn({ err: error, url }, "Failed to fetch metadata with yt-dlp");
		return null;
	} finally {
		if (cookieFilePath) {
			fs.unlink(cookieFilePath).catch((err) =>
				logger.warn({ err }, "Failed to clean up cookie file"),
			);
		}
	}
}

/**
 * Formats download metadata as Markdown for the description field.
 */
function formatMetadataAsMarkdown(item: DownloadItem): string {
	return item.description || "";
}

/**
 * helper to resolve creation date
 */
function resolveCreatedAt(
	item: DownloadItem,
	metadata: YtDlpOutput,
	fileMeta: { createdAt: Date },
): Date {
	if (item.createdAt) {
		const d = new Date(item.createdAt);
		if (!Number.isNaN(d.getTime())) {
			return d;
		}
	}
	if (metadata.upload_date) {
		const d = new Date(metadata.upload_date.replace(DATE_REGEX, "$1-$2-$3"));
		if (!Number.isNaN(d.getTime())) {
			return d;
		}
	}
	return fileMeta.createdAt;
}

// Update helper to determine media type from extension

async function handleYtDlpDownload(
	item: DownloadItem,
	mediaSourceId: string,
	basePath: string,
) {
	if (!item.targetUrl) {
		throw new Error("Missing targetUrl for yt-dlp download");
	}

	// Use yt-dlp
	logger.info({ url: item.targetUrl }, "[DownloadJob] Using yt-dlp");

	try {
		await waitForDownloadRateLimit();

		const results = await downloadWithYtDlp(
			item.targetUrl,
			basePath,
			item.cookies,
			item.userAgent,
		);

		logger.info(
			{ count: results.length },
			"[DownloadJob] yt-dlp download completed",
		);

		for (let i = 0; i < results.length; i++) {
			await _processSingleYtDlpResult({
				index: i,
				results,
				item,
				mediaSourceId,
				basePath,
			});
		}
	} catch (error) {
		logger.error({ err: error }, "[DownloadJob] yt-dlp download failed");

		// Notify frontend via SSE
		SseManager.sendEvent(mediaSourceId, "download-error", {
			url: item.targetUrl,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

async function _processSingleYtDlpResult(params: {
	index: number;
	results: { filePath: string; metadata: YtDlpOutput }[];
	item: DownloadItem;
	mediaSourceId: string;
	basePath: string;
}) {
	const { index, results, item, mediaSourceId, basePath } = params;
	const res = results[index];
	let { filePath, metadata } = res;

	// Unify filename
	const extension = path.extname(filePath);
	let unifiedName = generateMediaFilename(item, extension);

	// If multiple results for the same item, append index
	if (results.length > 1) {
		const ext = path.extname(unifiedName);
		const base = path.basename(unifiedName, ext);
		unifiedName = `${base}_${index}${ext}`;
	}

	const dir = path.dirname(filePath);
	const targetPath = await _resolveFinalPathWithAvoidance(
		dir,
		unifiedName,
		filePath,
	);

	try {
		await fs.rename(filePath, targetPath);
		filePath = targetPath;
		logger.info(
			{ from: res.filePath, to: filePath },
			"[DownloadJob] Renamed yt-dlp output to unified name",
		);
	} catch (e) {
		logger.warn(
			{ err: e, filePath, targetPath },
			"[DownloadJob] Failed to rename yt-dlp output",
		);
	}

	// Calculate relative path
	const relativePath = path.relative(basePath, filePath);

	// Determine media type
	const mediaType = getMediaTypeFromExtension(filePath);

	logger.info(
		{ relativePath, mediaType },
		"[DownloadJob] Processing file from yt-dlp",
	);

	// Get file metadata
	const fileMeta = await ServerMediaStorage.getFileMetadata(filePath);

	const newMedia: AddMediaRequest = {
		mediaSourceId,
		filePath: relativePath,
		fileName: path.basename(filePath),
		mediaType,
		description: item.description || metadata.description || metadata.title,
		width: metadata.width || fileMeta.width || 0,
		height: metadata.height || fileMeta.height || 0,
		fileSize: fileMeta.size,
		createdAt: resolveCreatedAt(item, metadata, fileMeta),
		modifiedAt: fileMeta.modifiedAt,
		sourceUrls: Array.from(
			new Set([item.targetUrl ?? "", ...(item.sourceUrls ?? [])]),
		),
	};

	await registerMedia(newMedia, mediaSourceId, item, basePath);
}

async function _resolveFinalPathWithAvoidance(
	dir: string,
	unifiedName: string,
	currentPath: string,
): Promise<string> {
	const ext = path.extname(unifiedName);
	const base = path.basename(unifiedName, ext);
	let finalPath = path.join(dir, unifiedName);
	let collisionIndex = 1;

	while (true) {
		if (finalPath === currentPath) {
			break;
		}
		try {
			await fs.access(finalPath);
			finalPath = path.join(dir, `${base}_(${collisionIndex})${ext}`);
			collisionIndex++;
		} catch {
			break;
		}
	}
	return finalPath;
}

function buildFetchHeaders(item: DownloadItem): Record<string, string> {
	const isDanbooru = item.targetUrl?.includes("donmai.us");

	if (isDanbooru) {
		// Mimic simple curl/browser behavior for Danbooru CDN
		return {
			"User-Agent": "curl/8.7.1", // Try a very simple UA if browser UA fails
			Accept: "*/*",
		};
	}

	const headers: Record<string, string> = {
		"User-Agent":
			item.userAgent ||
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
	};

	// Use the post url as referer to avoid hotlink prevention
	if (item.sourceUrls && item.sourceUrls.length > 0) {
		const refUrl = item.sourceUrls.at(-1);
		if (refUrl) {
			headers.Referer = refUrl;
		}
	} else if (item.targetUrl) {
		headers.Referer = `${new URL(item.targetUrl).origin}/`;
	}

	return headers;
}

/**
 * Handles direct image download (non-twitter)
 */
async function handleDirectImageDownload(
	item: DownloadItem,
	mediaSourceId: string,
	basePath: string,
) {
	if (!item.targetUrl) {
		throw new Error("Missing targetUrl for direct download");
	}

	logger.info(
		{ url: item.targetUrl },
		"[DownloadJob] Using direct image download method",
	);

	// Generate unified filename
	const urlPath = new URL(item.targetUrl).pathname;
	const extension = path.extname(urlPath) || ".png";
	const filename = generateMediaFilename(item, extension);

	try {
		// Download the image
		const headers = buildFetchHeaders(item);

		await waitForDownloadRateLimit();

		const response = await fetch(item.targetUrl, {
			headers,
		});
		if (!response.ok) {
			logger.error(
				{
					status: response.status,
					statusText: response.statusText,
					url: item.targetUrl,
				},
				"[DownloadJob] Fetch failed",
			);
			throw new Error(
				`Failed to download image: ${response.status} ${response.statusText}`,
			);
		}

		const arrayBuffer = await response.arrayBuffer();

		// Use ServerMediaStorage to save with autoIncrement
		const fileInfo = await ServerMediaStorage.saveFile(
			basePath,
			{
				name: filename,
				arrayBuffer: async () => arrayBuffer,
			},
			{
				filename,
				overwrite: false,
				autoIncrement: true,
			},
		);

		const fullPath = path.join(basePath, fileInfo.filePath);

		let createdAt = item.createdAt ? new Date(item.createdAt) : undefined;

		// If createdAt is missing, try to fetch from source URL (e.g. Tweet URL)
		if (!createdAt) {
			const tweetUrl = item.sourceUrls?.find((u) => u.match(TWITTER_URL_REGEX));
			if (tweetUrl) {
				logger.info(
					{ tweetUrl },
					"[DownloadJob] Attempting to fetch metadata from source URL for timestamp",
				);
				const meta = await fetchMetadataWithYtDlp(
					tweetUrl,
					item.cookies,
					item.userAgent,
				);
				if (meta?.upload_date) {
					createdAt = new Date(
						meta.upload_date.replace(DATE_REGEX, "$1-$2-$3"),
					);
					logger.info(
						{ createdAt },
						"[DownloadJob] Resolved createdAt from source URL",
					);
				}
			}
		}

		// Fallback to file creation time
		if (!createdAt) {
			createdAt = fileInfo.createdAt;
		}

		// Determine media type using getMediaType
		const mediaType = getMediaTypeFromExtension(fullPath);

		// Create media entry
		const newMedia: AddMediaRequest = {
			mediaSourceId,
			filePath: fileInfo.filePath,
			fileName: fileInfo.fileName,
			mediaType,
			description: formatMetadataAsMarkdown(item),
			width: fileInfo.width,
			height: fileInfo.height,
			fileSize: fileInfo.size,
			createdAt,
			modifiedAt: fileInfo.modifiedAt,
			sourceUrls: Array.from(
				new Set([item.targetUrl, ...(item.sourceUrls ?? [])]),
			),
		};

		await registerMedia(newMedia, mediaSourceId, item, basePath);

		logger.info(
			{ url: item.targetUrl },
			"[DownloadJob] Download completed successfully",
		);
	} catch (error) {
		logger.error(
			{ err: error, url: item.targetUrl },
			"[DownloadJob] Download failed",
		);

		// Notify frontend via SSE
		SseManager.sendEvent(mediaSourceId, "download-error", {
			url: item.targetUrl,
			error: error instanceof Error ? error.message : String(error),
		});

		throw error;
	}
}

/**
 * Extracts and normalizes a DownloadItem from a job payload.
 * Handles backward compatibility mapping.
 */
function getDownloadItemFromJob(job: Job): DownloadItem {
	if (!job.payload) {
		return {} as DownloadItem;
	}
	const payload = job.payload as any;
	const item = { ...payload } as unknown as DownloadItem;

	if (!item.targetUrl && payload?.imageUrl) {
		item.targetUrl = payload.imageUrl;
	}

	if (!item.description && payload?.description) {
		item.description = payload.description;
	}

	if (!item.sourceUrls) {
		item.sourceUrls = payload?.sourceUrl ? [payload.sourceUrl] : [];
	}

	return item;
}

export async function processDownloadJob(job: Job): Promise<void> {
	const mediaSourceId = job.mediaSourceId;
	if (!mediaSourceId) {
		logger.error({ jobId: job.id }, "Missing mediaSourceId in download job");
		return;
	}
	// Extract item directly from job payload (new schema) or fallbacks (backward compatibility)
	const item = getDownloadItemFromJob(job);

	if (!item.targetUrl) {
		logger.error({ job }, "[DownloadJob] Job payload missing targetUrl");
		return;
	}

	logger.info({ url: item.targetUrl }, "[DownloadJob] Starting download job");

	const sourceRepo = new DrizzleSourceRepository();
	const mediaSource = await sourceRepo.findById(mediaSourceId);
	if (!mediaSource || mediaSource.type !== "local") {
		const error = "Media source not found or not a local source";
		logger.error({ mediaSourceId }, `[DownloadJob] ${error}`);
		SseManager.sendEvent(mediaSourceId, "download-error", {
			url: item.targetUrl,
			error,
		});
		throw new Error(error);
	}

	const connectionInfo = mediaSource.connectionInfo as { path: string };
	const basePath = connectionInfo.path;

	// Decision: Direct download or yt-dlp?
	// Use regex to detect Twitter URLs which might need yt-dlp if target is the tweet link
	const isTwitterPost = item.targetUrl.match(TWITTER_URL_REGEX);

	logger.info(
		{ isTwitterPost: !!isTwitterPost },
		"[DownloadJob] URL pattern check",
	);

	try {
		if (isTwitterPost) {
			logger.info({}, "[DownloadJob] Using yt-dlp download method");
			await handleYtDlpDownload(item, mediaSourceId, basePath);
		} else {
			await handleDirectImageDownload(item, mediaSourceId, basePath);
		}
	} catch (error) {
		logger.error(
			{ err: error, url: item.targetUrl },
			"[DownloadJob] Job execution failed",
		);
		// Notify frontend via SSE
		SseManager.sendEvent(mediaSourceId, "download-error", {
			url: item.targetUrl,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

/**
 * Helper to update existing media with download metadata when media already exists
 * (handles race condition with FileWatcherService)
 */
async function updateExistingMediaWithMetadata(
	mediaId: string,
	mediaSourceId: string,
	newMedia: AddMediaRequest,
	item: DownloadItem,
): Promise<void> {
	const { MediaProcessingService } = await import(
		"~/application/services/media-processing-service"
	);

	await MediaProcessingService.addContextMetadataToExistingMedia(mediaId, {
		description: newMedia.description ?? undefined,
		sourceUrls: newMedia.sourceUrls,
		authors: item.authors?.map((a) => ({
			name: a.name,
			accountId: a.accountId ?? null,
		})),
		// We can also update other metadata if needed, consistent with registerMedia
		tags: item.tags,
		characters: item.characters,
		ips: item.ips,
		projects: item.projects,
	});

	SseManager.sendEvent(mediaSourceId, "media-added", { mediaId });
	logger.info(
		{ mediaId },
		"[DownloadJob] Existing media updated with download metadata",
	);
}

async function registerMedia(
	newMedia: AddMediaRequest,
	mediaSourceId: string,
	item: DownloadItem,
	_basePath: string,
) {
	try {
		// Use MediaProcessingService for unified registration and processing
		const { MediaProcessingService } = await import(
			"~/application/services/media-processing-service"
		);

		const insertedMedia = await MediaProcessingService.registerAndProcess(
			mediaSourceId,
			newMedia.filePath,
			{
				description: newMedia.description ?? undefined,
				createdAt: newMedia.createdAt,
				sourceUrls: newMedia.sourceUrls,
				authors: item.authors?.map((a) => ({
					name: a.name,
					accountId: a.accountId ?? null,
				})),
				tags: item.tags,
				characters: item.characters,
				ips: item.ips,
				projects: item.projects,
				generationInfo: item.generationInfo,
			},
		);

		logger.info(
			{ mediaId: insertedMedia.id, filePath: newMedia.filePath },
			"[DownloadJob] Media registered via MediaProcessingService",
		);
	} catch (error) {
		// Handle race condition with FileWatcherService
		const existing = await MediaRepository.findByPath(
			mediaSourceId,
			newMedia.filePath,
		);
		if (existing) {
			await updateExistingMediaWithMetadata(
				existing.id,
				mediaSourceId,
				newMedia,
				item,
			);
		} else {
			throw error;
		}
	}
}

/**
 * Queues multiple download jobs from a list of download items.
 */
export async function queueDownloadJobs(
	mediaSourceId: string,
	items: DownloadItem[],
): Promise<number> {
	const sourceRepo = new DrizzleSourceRepository();
	const mediaSource = await sourceRepo.findById(mediaSourceId);
	if (!mediaSource || mediaSource.type !== "local") {
		throw new Error("Media source not found or not a local source");
	}

	const repo = services.getJobRepository();

	for (const item of items) {
		await repo.create({
			type: "downloadImage",
			mediaSourceId,
			payload: {
				...item,
				// Backward compatibility fields
				imageUrl: item.targetUrl,
				sourceUrl: item.targetUrl,
				description: item.description ?? formatMetadataAsMarkdown(item),
				createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
			},
		});
	}

	// Jobs are picked up by the worker automatically.

	return items.length;
}
