/**
 * Download Jobs - Handles downloading images from URLs
 */

import fs, { open } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	type DownloadArtifact,
	queueDownloadJobs as queueSharedDownloadJobs,
	runDownloadImageJob,
} from "@solid-imager/application/services/download-job-runner";
import type { MediaPathAdapter } from "@solid-imager/application/services/media-service";
import { resolveUploadTargetPath } from "@solid-imager/application/services/media-upload-utils";
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

const JPEG_EOI = Buffer.from([0xff, 0xd9]);
const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PNG_IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);

async function validateImageIntegrity(filePath: string): Promise<void> {
	const fd = await open(filePath, "r");
	try {
		const { size } = await fd.stat();
		if (size === 0) {
			throw new Error(`Downloaded file is empty: ${filePath}`);
		}

		const header = Buffer.allocUnsafe(Math.min(16, size));
		await fd.read(header, 0, header.length, 0);

		const isJpeg = header[0] === 0xff && header[1] === 0xd8;
		const isPng = size >= 8 && header.subarray(0, 8).equals(PNG_SIGNATURE);

		if (isJpeg) {
			const tail = Buffer.allocUnsafe(2);
			await fd.read(tail, 0, 2, size - 2);
			if (!tail.equals(JPEG_EOI)) {
				throw new Error(
					`Truncated JPEG file (missing end marker FFD9): ${filePath} (${size} bytes)`,
				);
			}
		} else if (isPng) {
			const tail = Buffer.allocUnsafe(8);
			await fd.read(tail, 0, 8, size - 8);
			if (!tail.equals(PNG_IEND)) {
				throw new Error(
					`Truncated PNG file (missing IEND chunk): ${filePath} (${size} bytes)`,
				);
			}
		}
	} finally {
		await fd.close();
	}
}

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
	"image/jpeg": ".jpg",
	"image/png": ".png",
	"image/webp": ".webp",
	"image/gif": ".gif",
	"image/avif": ".avif",
};

function resolveExtensionFromContentType(
	contentType: string | null,
	fallback: string,
): string {
	if (!contentType) return fallback;
	const mime = contentType.split(";")[0].trim().toLowerCase();
	return CONTENT_TYPE_TO_EXT[mime] ?? fallback;
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

let ytDlpPathCache: string | null = null;

async function resolveYtDlpPath(): Promise<string> {
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
		const candidate = path.join(dir, "node_modules/youtube-dl-exec/bin/yt-dlp");
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

async function downloadAndSaveImage(
	targetUrl: string,
	item: DownloadItem,
	context: { basePath: string },
	headers: Record<string, string>,
	fallbackExt: string,
): Promise<Awaited<ReturnType<typeof ServerMediaStorage.saveFile>>> {
	await waitForDownloadRateLimit();
	const response = await fetch(targetUrl, {
		headers,
		signal: AbortSignal.timeout(30000),
	});
	if (!response.ok) {
		throw new Error(
			`Failed to download image: ${response.status} ${response.statusText}`,
		);
	}
	const extension = resolveExtensionFromContentType(
		response.headers.get("content-type"),
		fallbackExt,
	);
	const filename = generateMediaFilename(item, extension);
	const arrayBuffer = await response.arrayBuffer();
	const fileInfo = await ServerMediaStorage.saveFile(
		context.basePath,
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
	return fileInfo;
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

const pathAdapter: MediaPathAdapter = {
	join: path.join,
	extname: path.extname,
	basename: path.basename,
	relative: path.relative,
};

/**
 * Extracts and normalizes a DownloadItem from a job payload.
 * Handles backward compatibility mapping.
 */
export async function processDownloadJob(job: Job): Promise<void> {
	await runDownloadImageJob(job, {
		resolveBasePath: async (mediaSourceId) => {
			const sourceRepo = new DrizzleSourceRepository();
			const mediaSource = await sourceRepo.findById(mediaSourceId);
			if (!mediaSource || mediaSource.type !== "local") {
				throw new Error("Media source not found or not a local source");
			}
			return (mediaSource.connectionInfo as { path: string }).path;
		},
		selectMode: (item) =>
			item.targetUrl?.match(TWITTER_URL_REGEX) ? "specialized" : "direct",
		download: async (item, context) => {
			if (!item.targetUrl) {
				throw new Error("Missing targetUrl");
			}
			if (context.mode === "specialized") {
				const results = await downloadWithYtDlp(
					item.targetUrl,
					context.basePath,
					item.cookies,
					item.userAgent,
				);
				const artifacts: DownloadArtifact[] = [];
				for (let index = 0; index < results.length; index++) {
					const res = results[index];
					let { filePath, metadata } = res;
					const extension = path.extname(filePath);
					let unifiedName = generateMediaFilename(item, extension);
					if (results.length > 1) {
						const ext = path.extname(unifiedName);
						const base = path.basename(unifiedName, ext);
						unifiedName = `${base}_${index}${ext}`;
					}
					const dir = path.dirname(filePath);
					const resolved = await resolveUploadTargetPath(
						dir,
						unifiedName,
						false,
						true,
						{
							pathAdapter,
							exists: async (p) => {
								try {
									await fs.access(p);
									return true;
								} catch {
									return false;
								}
							},
							skipIfEquals: filePath,
						},
					);
					if (resolved.fullPath !== filePath) {
						await fs.rename(filePath, resolved.fullPath);
						filePath = resolved.fullPath;
					}
					const relativePath = path.relative(context.basePath, filePath);
					const mediaType = getMediaTypeFromExtension(filePath);
					const fileMeta = await ServerMediaStorage.getFileMetadata(filePath);
					artifacts.push({
						mediaSourceId: context.mediaSourceId,
						filePath: relativePath,
						fileName: path.basename(filePath),
						mediaType,
						description:
							item.description || metadata.description || metadata.title,
						width: metadata.width || fileMeta.width || 0,
						height: metadata.height || fileMeta.height || 0,
						fileSize: fileMeta.size,
						createdAt: resolveCreatedAt(item, metadata, fileMeta),
						modifiedAt: fileMeta.modifiedAt,
						sourceUrls: Array.from(
							new Set([item.targetUrl ?? "", ...(item.sourceUrls ?? [])]),
						),
					});
				}
				return artifacts;
			}

			const urlPath = new URL(item.targetUrl).pathname;
			const fallbackExt = path.extname(urlPath) || ".png";
			const headers = buildFetchHeaders(item);

			let fileInfo = await downloadAndSaveImage(
				item.targetUrl,
				item,
				context,
				headers,
				fallbackExt,
			);

			// Validate integrity, retry once on failure
			try {
				const fullPath = path.join(context.basePath, fileInfo.filePath);
				await validateImageIntegrity(fullPath);
			} catch (validationError) {
				logger.warn(
					{ err: validationError, url: item.targetUrl },
					"Image validation failed, retrying download",
				);
				await fs
					.unlink(path.join(context.basePath, fileInfo.filePath))
					.catch(() => {});

				fileInfo = await downloadAndSaveImage(
					item.targetUrl,
					item,
					context,
					headers,
					fallbackExt,
				);

				const retryFullPath = path.join(context.basePath, fileInfo.filePath);
				await validateImageIntegrity(retryFullPath);
			}
			let createdAt = item.createdAt ? new Date(item.createdAt) : undefined;
			if (createdAt && Number.isNaN(createdAt.getTime())) {
				createdAt = undefined;
			}
			if (!createdAt) {
				const tweetUrl = item.sourceUrls?.find((u) =>
					u.match(TWITTER_URL_REGEX),
				);
				if (tweetUrl) {
					const meta = await fetchMetadataWithYtDlp(
						tweetUrl,
						item.cookies,
						item.userAgent,
					);
					if (meta?.upload_date) {
						const d = new Date(
							meta.upload_date.replace(DATE_REGEX, "$1-$2-$3"),
						);
						if (!Number.isNaN(d.getTime())) {
							createdAt = d;
						}
					}
				}
			}
			return [
				{
					mediaSourceId: context.mediaSourceId,
					filePath: fileInfo.filePath,
					fileName: fileInfo.fileName,
					mediaType: getMediaTypeFromExtension(
						path.join(context.basePath, fileInfo.filePath),
					),
					description: formatMetadataAsMarkdown(item),
					width: fileInfo.width,
					height: fileInfo.height,
					fileSize: fileInfo.size,
					createdAt: createdAt ?? fileInfo.createdAt,
					modifiedAt: fileInfo.modifiedAt,
					sourceUrls: Array.from(
						new Set([item.targetUrl, ...(item.sourceUrls ?? [])]),
					),
				},
			];
		},
		registerMedia: async (artifact, context) => {
			const newMedia: AddMediaRequest = {
				mediaSourceId: context.mediaSourceId,
				filePath: artifact.filePath,
				fileName: artifact.fileName,
				mediaType: artifact.mediaType,
				description: artifact.description,
				width: artifact.width,
				height: artifact.height,
				fileSize: artifact.fileSize ?? 0,
				createdAt: artifact.createdAt,
				modifiedAt: artifact.modifiedAt,
				sourceUrls: artifact.sourceUrls,
			};
			await registerMedia(
				newMedia,
				context.mediaSourceId,
				context.item,
				context.basePath,
			);
		},
		events: {
			downloadError: (event) => {
				SseManager.sendEvent(
					job.mediaSourceId ?? "global-jobs",
					"download-error",
					{
						url: event.url,
						error: event.error,
					},
				);
			},
		},
		logger,
	});
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
	return await queueSharedDownloadJobs(repo, mediaSourceId, items);
}
