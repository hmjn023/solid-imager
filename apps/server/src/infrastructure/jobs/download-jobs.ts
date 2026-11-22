/**
 * Download Jobs - Handles downloading media from URLs
 */

import fs from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import type { Transaction } from "@solid-imager/core/ports";
import { ResourceConflictError } from "@solid-imager/core/errors";
import { getExecutor } from "~/infrastructure/db/executor";
import path from "node:path";
import {
	type AddMediaRequest,
	addMediaRequestSchema,
	type DownloadItem,
	downloadItemSchema,
} from "@solid-imager/core/media";
import {
	generateMediaFilename,
	getMediaTypeFromExtension,
} from "@solid-imager/core/media/files";
import { asyncPool, isRecord } from "@solid-imager/core/utils";
import { z } from "zod";
import {
	importWorkOwner,
	type Job,
	type ImportWorkOwner,
} from "@solid-imager/core/jobs";
import { createImportBatch, lockActiveDownloadUrls } from "@solid-imager/db";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { jobs, type NewJob } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { waitForDownloadRateLimit } from "~/infrastructure/jobs/download-rate-limiter";
import { logger } from "~/infrastructure/logger";
import {
	MediaRepository,
	JobRepository,
	DrizzleSourceRepository,
	TagDictionaryRepository,
} from "~/infrastructure/db/repositories";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";
import { downloadUgoiraArchive } from "~/infrastructure/services/ugoira-download";
import { convertUgoiraToMp4 } from "~/infrastructure/services/ugoira-converter";
import {
	fetchTwitterPost,
	getTwitterPostReference,
} from "~/infrastructure/services/twitter-post";

const DATE_REGEX = /(\d{4})(\d{2})(\d{2})/;
const MEDIA_EXTENSION_BY_CONTENT_TYPE: Readonly<Record<string, string>> = {
	"image/avif": ".avif",
	"image/bmp": ".bmp",
	"image/gif": ".gif",
	"image/jpeg": ".jpg",
	"image/jpg": ".jpg",
	"image/png": ".png",
	"image/svg+xml": ".svg",
	"image/tiff": ".tiff",
	"image/webp": ".webp",
	"video/mp4": ".mp4",
	"video/webm": ".webm",
};

const downloadMetadataSchema = z.object({
	description: z.string().optional(),
	title: z.string().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	dateEpoch: z.number().optional(),
	// Older in-flight jobs checkpointed the date as YYYYMMDD.
	upload_date: z.string().optional(),
});

const savedDownloadRegistration = addMediaRequestSchema.pick({
	filePath: true,
	createdAt: true,
	description: true,
	sourceUrls: true,
});
type DownloadRegistration = z.infer<typeof savedDownloadRegistration>;

const downloadOutputsSchema = z.array(
	z.object({
		filePath: z.string(),
		targetPath: z.string(),
		metadata: downloadMetadataSchema,
	}),
);

type DownloadOutput = z.infer<typeof downloadOutputsSchema>[number];

async function stageTwitterDownloads(
	postReference: NonNullable<ReturnType<typeof getTwitterPostReference>>,
	item: DownloadItem,
	basePath: string,
	job: Job,
): Promise<DownloadOutput[]> {
	const post = await fetchTwitterPost(postReference.id);
	const videos =
		postReference.videoIndex === undefined
			? post.videos
			: post.videos.filter((video) => video.index === postReference.videoIndex);
	if (videos.length === 0) {
		throw new Error("vxTwitter returned no downloadable MP4 for the post");
	}

	await fs.mkdir(basePath, { recursive: true });
	const outputs: DownloadOutput[] = [];
	const stagedPaths: string[] = [];
	try {
		for (const [index, media] of videos.entries()) {
			const response = await fetchMedia(
				media.url,
				{ Accept: "*/*" },
				{
					redirect: "error",
					signal: AbortSignal.timeout(120_000),
				},
			);
			if (response.extension !== ".mp4") {
				throw new Error("vxTwitter video did not return an MP4");
			}
			const { extension } = response;
			const filePath = path.resolve(
				basePath,
				`.${job.id}-vx-${job.attemptCount}-${index}${extension}`,
			);
			const name = generateMediaFilename(item, extension);
			const indexed =
				videos.length === 1
					? name
					: `${path.basename(name, extension)}_${index}${extension}`;
			const targetPath = await resolveFinalPathWithAvoidance(
				path.dirname(filePath),
				indexed,
				filePath,
			);
			const stream = response.body.body;
			if (!stream) throw new Error("X media response body is empty");
			stagedPaths.push(filePath);
			await fs.writeFile(filePath, stream.values());
			outputs.push({
				filePath,
				targetPath,
				metadata: {
					description: post.text,
					dateEpoch: post.dateEpoch,
					width: media.size?.width,
					height: media.size?.height,
				},
			});
		}
		return outputs;
	} catch (error) {
		await Promise.allSettled(
			stagedPaths.map((filePath) => fs.rm(filePath, { force: true })),
		);
		throw error;
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
	metadata: DownloadOutput["metadata"],
	fileMeta: { createdAt: Date },
): Date {
	if (item.createdAt) {
		const d = new Date(item.createdAt);
		if (!Number.isNaN(d.getTime())) {
			return d;
		}
	}
	if (metadata.dateEpoch !== undefined)
		return new Date(metadata.dateEpoch * 1000);
	if (metadata.upload_date) {
		const d = new Date(metadata.upload_date.replace(DATE_REGEX, "$1-$2-$3"));
		if (!Number.isNaN(d.getTime())) {
			return d;
		}
	}
	return fileMeta.createdAt;
}

async function handleTwitterDownload(
	postReference: NonNullable<ReturnType<typeof getTwitterPostReference>>,
	item: DownloadItem,
	mediaSourceId: string,
	basePath: string,
	job: Job,
) {
	const owner = importWorkOwner(job);
	const payload = isRecord(job.payload) ? job.payload : {};
	const checkpoint = z
		.object({
			downloadOutputs: downloadOutputsSchema.optional(),
			nextOutput: z.number().int().nonnegative().default(0),
		})
		.parse(owner ? payload : {});
	const outputs =
		checkpoint.downloadOutputs ??
		(await stageTwitterDownloads(postReference, item, basePath, job));
	const checkpointOutputs = async (nextOutput: number) => {
		if (owner)
			await JobRepository.update(
				job.id,
				{ payload: { ...payload, downloadOutputs: outputs, nextOutput } },
				owner.attempt,
			);
	};
	if (!checkpoint.downloadOutputs) await checkpointOutputs(0);
	for (let i = checkpoint.nextOutput; i < outputs.length; i++) {
		if (owner && (await JobRepository.isCancellationRequested(job.id))) {
			for (const { filePath } of outputs.slice(i)) {
				if (
					path.dirname(filePath) === path.resolve(basePath) &&
					path.basename(filePath).startsWith(`.${job.id}-`)
				) {
					await fs.rm(filePath, { force: true });
				}
			}
			return;
		}
		await publishDownloadOutput(outputs[i], !!checkpoint.downloadOutputs, () =>
			checkpointOutputs(i),
		);
		await registerDownloadOutput(
			outputs[i],
			item,
			mediaSourceId,
			basePath,
			owner,
		);
		await checkpointOutputs(i + 1);
	}
}

/** Publish without replacing another import between choosing a name and registering it. */
async function publishDownloadOutput(
	output: DownloadOutput,
	resuming: boolean,
	checkpoint: () => Promise<void>,
) {
	const { filePath } = output;
	const dir = path.dirname(output.targetPath);
	const name = path.basename(output.targetPath);
	while (filePath !== output.targetPath) {
		try {
			try {
				await fs.link(filePath, output.targetPath);
			} catch (err) {
				if (
					!isRecord(err) ||
					!["ENOTSUP", "EPERM", "EXDEV", "EOPNOTSUPP"].includes(
						String(err.code),
					)
				)
					throw err;
				await fs.copyFile(filePath, output.targetPath, constants.COPYFILE_EXCL);
			}
		} catch (err) {
			if (resuming && isRecord(err) && err.code === "ENOENT") {
				await fs.access(output.targetPath);
				return;
			}
			if (!isRecord(err) || err.code !== "EEXIST") throw err;
			const [from, to] = await Promise.all([
				fs.stat(filePath),
				fs.stat(output.targetPath),
			]);
			// A worker can exit after linking and before removing its temporary name.
			if (!from.ino || from.dev !== to.dev || from.ino !== to.ino) {
				output.targetPath = await resolveFinalPathWithAvoidance(
					dir,
					name,
					filePath,
				);
				await checkpoint();
				continue;
			}
		}
		await fs.unlink(filePath);
		return;
	}
}

async function registerDownloadOutput(
	output: DownloadOutput,
	item: DownloadItem,
	mediaSourceId: string,
	basePath: string,
	owner?: ImportWorkOwner,
) {
	const { metadata, targetPath: filePath } = output;
	// Calculate relative path
	const relativePath = path.relative(basePath, filePath);

	// Determine media type
	const mediaType = getMediaTypeFromExtension(filePath);

	logger.info(
		{ relativePath, mediaType },
		"[DownloadJob] Processing file from X post",
	);

	// Get file metadata
	const fileMeta = await ServerMediaStorage.getFileMetadata(filePath);

	const newMedia: AddMediaRequest = {
		mediaSourceId,
		filePath: relativePath,
		fileName: path.basename(filePath),
		mediaType,
		description:
			item.description || metadata.description || metadata.title || null,
		width: fileMeta.width || metadata.width || 0,
		height: fileMeta.height || metadata.height || 0,
		fileSize: fileMeta.size,
		createdAt: resolveCreatedAt(item, metadata, fileMeta),
		modifiedAt: fileMeta.modifiedAt,
		sourceUrls: Array.from(
			new Set([item.targetUrl ?? "", ...(item.sourceUrls ?? [])]),
		),
	};

	await registerMedia(newMedia, mediaSourceId, item, basePath, owner);
}

async function resolveFinalPathWithAvoidance(
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

async function fetchMedia(
	url: string,
	headers: Record<string, string>,
	options?: RequestInit,
) {
	await waitForDownloadRateLimit();
	const body = await fetch(url, { ...options, headers });
	if (!body.ok) {
		throw new Error(
			`Failed to download media: ${body.status} ${body.statusText}`,
		);
	}
	const contentType = body.headers
		.get("content-type")
		?.split(";", 1)[0]
		.trim()
		.toLowerCase();
	const extension =
		contentType && Object.hasOwn(MEDIA_EXTENSION_BY_CONTENT_TYPE, contentType)
			? MEDIA_EXTENSION_BY_CONTENT_TYPE[contentType]
			: undefined;
	if (!extension) {
		throw new Error(
			`Unsupported direct media content type: ${contentType ?? "unknown content type"}`,
		);
	}
	return { body, extension };
}

/**
 * Handles direct image and video downloads (non-Twitter).
 */
async function handleDirectMediaDownload(
	item: DownloadItem,
	mediaSourceId: string,
	basePath: string,
	owner?: ImportWorkOwner,
) {
	if (!item.targetUrl) {
		throw new Error("Missing targetUrl for direct download");
	}

	logger.info(
		{ url: item.targetUrl },
		"[DownloadJob] Using direct media download method",
	);

	try {
		const { body, extension } = await fetchMedia(
			item.targetUrl,
			buildFetchHeaders(item),
		);
		const filename = generateMediaFilename(item, extension);

		const arrayBuffer = await body.arrayBuffer();

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

		if (!createdAt) {
			const postId = item.sourceUrls
				?.map(getTwitterPostReference)
				.find(Boolean)?.id;
			if (postId) {
				try {
					const post = await fetchTwitterPost(postId);
					createdAt = new Date(post.dateEpoch * 1000);
				} catch (error) {
					logger.warn(
						{ err: error, postId },
						"Failed to fetch X post timestamp",
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

		await registerPublishedDownload(
			newMedia,
			mediaSourceId,
			item,
			basePath,
			owner,
		);

		logger.info(
			{ url: item.targetUrl },
			"[DownloadJob] Download completed successfully",
		);
	} catch (error) {
		logger.error(
			{ err: error, url: item.targetUrl },
			"[DownloadJob] Download failed",
		);

		// Notify frontend through the typed event bus.
		RealtimeEventBus.publishSource(mediaSourceId, "download-error", {
			url: item.targetUrl,
			error: error instanceof Error ? error.message : String(error),
		});

		throw error;
	}
}

/** Publish a completed conversion without overwriting another download. */
async function publishUgoira(
	outputPath: string,
	basePath: string,
	filename: string,
): Promise<string> {
	const stem = path.basename(filename, ".mp4");
	for (let index = 0; ; index++) {
		const name = index === 0 ? filename : `${stem}_(${index}).mp4`;
		try {
			await fs.link(outputPath, path.join(basePath, name));
			return name;
		} catch (error) {
			if (
				isRecord(error) &&
				["ENOTSUP", "EOPNOTSUPP", "EPERM", "ENOSYS"].some(
					(code) => code === error.code,
				)
			) {
				throw new Error(
					"Publishing ugoira requires a destination that allows hard links",
					{ cause: error },
				);
			}
			if (!isRecord(error) || error.code !== "EEXIST") throw error;
		}
	}
}

async function handleUgoiraDownload(
	item: DownloadItem,
	mediaSourceId: string,
	basePath: string,
	owner?: ImportWorkOwner,
): Promise<void> {
	if (!item.ugoira || !item.targetUrl)
		throw new Error("Missing ugoira download metadata");
	// Keep staging on the destination filesystem for atomic publication. Watchers ignore dotfiles.
	await fs.mkdir(basePath, { recursive: true });
	const staging = await fs.mkdtemp(path.join(basePath, ".xtracter-ugoira-"));
	try {
		const archivePath = path.join(staging, "frames.zip");
		const videoPath = path.join(staging, "animation.mp4");
		await waitForDownloadRateLimit();
		await downloadUgoiraArchive(item, archivePath);
		const { width, height } = await convertUgoiraToMp4(
			archivePath,
			videoPath,
			item.ugoira.frames,
		);
		const stats = await fs.stat(videoPath);
		const fileName = await publishUgoira(
			videoPath,
			basePath,
			generateMediaFilename(item, ".mp4"),
		);
		try {
			await registerPublishedDownload(
				{
					mediaSourceId,
					filePath: fileName,
					fileName,
					mediaType: "video",
					description: formatMetadataAsMarkdown(item),
					width,
					height,
					fileSize: stats.size,
					createdAt: item.createdAt ?? stats.birthtime,
					modifiedAt: stats.mtime,
					sourceUrls: [
						...new Set([item.targetUrl, ...(item.sourceUrls ?? [])]),
					],
				},
				mediaSourceId,
				item,
				basePath,
				owner,
			);
		} catch (error) {
			// A watcher may already own the file. Remove only an unregistered result.
			try {
				if (
					!owner &&
					!(await MediaRepository.findByPath(mediaSourceId, fileName))
				) {
					await fs.unlink(path.join(basePath, fileName));
				}
			} catch (cleanupError) {
				logger.warn(
					{ err: cleanupError, fileName },
					"[DownloadJob] Could not confirm ugoira registration for cleanup",
				);
			}
			throw error;
		}
		logger.info(
			{ url: item.targetUrl, fileName },
			"[DownloadJob] Ugoira converted and registered",
		);
	} finally {
		await fs.rm(staging, { recursive: true, force: true });
	}
}

async function resolvePixivTags(item: DownloadItem): Promise<DownloadItem> {
	const tags = item.tags;
	if (!tags?.length) return item;
	const pixivNames = tags
		.filter((tag) => tag.source === "pixiv")
		.map((tag) => tag.name);
	if (!pixivNames.length) return item;

	const matches = await TagDictionaryRepository.matchNames(pixivNames);
	return {
		...item,
		tags: tags.map((tag) => {
			const name = tag.source === "pixiv" ? matches.get(tag.name) : undefined;
			return name ? { ...tag, name } : tag;
		}),
	};
}

export async function processDownloadJob(job: Job): Promise<void> {
	const mediaSourceId = job.mediaSourceId;
	if (!mediaSourceId) {
		logger.error({ jobId: job.id }, "Missing mediaSourceId in download job");
		return;
	}
	const input = downloadItemSchema.parse(job.payload);

	if (!input.targetUrl) {
		logger.error({ job }, "[DownloadJob] Job payload missing targetUrl");
		throw new Error("Download job payload missing targetUrl");
	}

	logger.info({ url: input.targetUrl }, "[DownloadJob] Starting download job");

	const sourceRepo = DrizzleSourceRepository;
	const mediaSource = await sourceRepo.findById(mediaSourceId);
	if (mediaSource?.type !== "local") {
		const error = "Media source not found or not a local source";
		logger.error({ mediaSourceId }, `[DownloadJob] ${error}`);
		RealtimeEventBus.publishSource(mediaSourceId, "download-error", {
			url: input.targetUrl,
			error,
		});
		throw new Error(error);
	}

	const connectionInfo = mediaSource.connectionInfo as { path: string };
	const basePath = connectionInfo.path;

	const postReference = getTwitterPostReference(input.targetUrl);

	try {
		const item = await resolvePixivTags(input);
		const owner = importWorkOwner(job);
		if (owner && isRecord(job.payload) && job.payload.savedDownload) {
			const saved = savedDownloadRegistration.parse(job.payload.savedDownload);
			await registerMedia(saved, mediaSourceId, item, basePath, owner);
			return;
		}
		if (item.ugoira) {
			await handleUgoiraDownload(
				item,
				mediaSourceId,
				basePath,
				importWorkOwner(job),
			);
		} else if (postReference) {
			await handleTwitterDownload(
				postReference,
				item,
				mediaSourceId,
				basePath,
				job,
			);
		} else {
			await handleDirectMediaDownload(
				item,
				mediaSourceId,
				basePath,
				importWorkOwner(job),
			);
		}
	} catch (error) {
		logger.error(
			{ err: error, url: input.targetUrl },
			"[DownloadJob] Job execution failed",
		);
		// Notify frontend through the typed event bus.
		RealtimeEventBus.publishSource(mediaSourceId, "download-error", {
			url: input.targetUrl,
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
	newMedia: DownloadRegistration,
	item: DownloadItem,
): Promise<void> {
	const { MediaProcessingService } =
		await import("~/infrastructure/services/media-processing-service");

	await MediaProcessingService.addContextMetadataToExistingMedia(mediaId, {
		description: newMedia.description ?? undefined,
		sourceUrls: newMedia.sourceUrls,
		authors: item.authors,
		// We can also update other metadata if needed, consistent with registerMedia
		tags: item.tags,
		characters: item.characters,
		ips: item.ips,
		projects: item.projects,
	});

	RealtimeEventBus.publishSource(mediaSourceId, "media-added", {
		mediaId,
		filePath: newMedia.filePath,
	});
	logger.info(
		{ mediaId },
		"[DownloadJob] Existing media updated with download metadata",
	);
}

async function registerPublishedDownload(
	newMedia: AddMediaRequest,
	mediaSourceId: string,
	item: DownloadItem,
	basePath: string,
	owner?: ImportWorkOwner,
) {
	if (owner) {
		const producer = await JobRepository.findById(owner.workId);
		if (!isRecord(producer?.payload) || producer.cancelRequestedAt)
			throw new Error("Download no longer active");
		await JobRepository.update(
			owner.workId,
			{
				payload: {
					...producer.payload,
					savedDownload: savedDownloadRegistration.parse(newMedia),
				},
			},
			owner.attempt,
		);
	}
	await registerMedia(newMedia, mediaSourceId, item, basePath, owner);
}

async function registerMedia(
	newMedia: DownloadRegistration,
	mediaSourceId: string,
	item: DownloadItem,
	basePath: string,
	owner?: ImportWorkOwner,
) {
	try {
		// Use MediaProcessingService for unified registration and processing
		const { MediaProcessingService } =
			await import("~/infrastructure/services/media-processing-service");

		const insertedMedia = await MediaProcessingService.registerAndProcess(
			mediaSourceId,
			newMedia.filePath,
			{
				description: newMedia.description ?? undefined,
				createdAt: newMedia.createdAt,
				sourceUrls: newMedia.sourceUrls,
				authors: item.authors,
				tags: item.tags,
				characters: item.characters,
				ips: item.ips,
				projects: item.projects,
				generationInfo: item.generationInfo,
			},
			...(owner ? ([owner] as const) : []),
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
			if (owner) {
				const { JobRepository } =
					await import("~/infrastructure/db/repositories");
				await JobRepository.createIfUnique(
					{
						type: "processMedia",
						mediaSourceId,
						payload: { mediaId: existing.id, sourcePath: basePath },
					},
					owner,
				);
			}
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

/** A stable queue identity for a submitted import; retained even after the download finishes. */
export function importDownloadJobId(requestId: string): string {
	const bytes = createHash("sha1")
		.update("solid-imager:import-download:")
		.update(requestId)
		.digest()
		.subarray(0, 16);
	bytes[6] = (bytes[6] & 0x0f) | 0x50;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = bytes.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Queue one target per distinct approved URL, or skip it if it is already saved. */
export async function queueDownloadJobs(
	mediaSourceId: string,
	items: DownloadItem[],
	options: { transaction?: Transaction; requestIds?: string[] } = {},
): Promise<{ jobCount: number; skippedCount: number; batchId?: string }> {
	if (options.requestIds && options.requestIds.length !== items.length)
		throw new Error("Import queue identities must match the items");
	if (options.requestIds && !options.transaction) {
		return DrizzleTransactionManager.transaction((transaction) =>
			queueDownloadJobs(mediaSourceId, items, { ...options, transaction }),
		);
	}
	const sourceRepo = DrizzleSourceRepository;
	const mediaSource = await sourceRepo.findById(
		mediaSourceId,
		options.transaction,
	);
	if (mediaSource?.type !== "local") {
		throw new Error("Media source not found or not a local source");
	}

	const seenUrls = new Set<string>();
	const entries = items
		.map((item, index) => ({ item, requestId: options.requestIds?.[index] }))
		.filter(({ item, requestId }) => {
			if (!requestId || !item.targetUrl) return true;
			if (seenUrls.has(item.targetUrl)) return false;
			seenUrls.add(item.targetUrl);
			return true;
		});
	if (options.requestIds) {
		const active = await lockActiveDownloadUrls(
			getExecutor(options.transaction),
			mediaSourceId,
			[...seenUrls],
		);
		if (active.size) {
			throw new ResourceConflictError(
				"Some selected files are already being downloaded to this destination. Wait for those downloads to finish or deselect the matching requests.",
			);
		}
	}
	// Look for saved media after checking active downloads.
	const poolResults = await asyncPool(entries, 5, async ({ item }) => {
		const urls = item.sourceUrls || [];
		if (urls.length < 2) return { item, skip: false };
		const existingMediaId = await MediaRepository.findMediaIdWithMatchingUrlSet(
			urls,
			options.transaction,
		);
		if (existingMediaId) {
			logger.info(
				{ urls, existingMediaId, fileName: item.fileName },
				"Skipping duplicate download item (source URLs already exist)",
			);
			return { item, skip: true, mediaId: existingMediaId };
		}
		return { item, skip: false };
	});

	if (items.length > 1) {
		const targets = entries.map(({ item, requestId }, index) => {
			const result = poolResults[index];
			return {
				label: path.win32.basename(
					item.fileName || generateMediaFilename(item, ""),
				),
				mediaId:
					result.status === "fulfilled" ? result.value.mediaId : undefined,
				skipped: result.status === "fulfilled" && result.value.skip,
				work: {
					...(requestId ? { id: importDownloadJobId(requestId) } : {}),
					type: "downloadImage",
					payload: {
						...item,
						description: item.description ?? formatMetadataAsMarkdown(item),
					},
				},
			};
		});
		const insert = (tx: Transaction) =>
			createImportBatch(getExecutor(tx), mediaSourceId, targets);
		const batch = options.transaction
			? await insert(options.transaction)
			: await DrizzleTransactionManager.transaction(insert);
		const skippedCount = targets.filter((target) => target.skipped).length;
		return {
			jobCount: targets.length - skippedCount,
			skippedCount,
			batchId: batch.id,
		};
	}
	const newItems: DownloadItem[] = [];
	let skippedCount = 0;
	for (const [index, result] of poolResults.entries()) {
		if (result.status === "rejected") {
			logger.warn(
				{ err: result.reason, item: items[index] },
				"Failed to check duplicate download item; keeping it in the batch",
			);
			newItems.push(items[index]);
		} else if (result.value.skip) {
			skippedCount++;
		} else {
			newItems.push(result.value.item);
		}
	}

	const jobRows: NewJob[] = newItems.map((item) => ({
		...(options.requestIds
			? { id: importDownloadJobId(options.requestIds[items.indexOf(item)]) }
			: {}),
		type: "downloadImage",
		mediaSourceId,
		payload: {
			...item,
			description: item.description ?? formatMetadataAsMarkdown(item),
			createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
		},
	}));
	if (jobRows.length === 0) return { jobCount: 0, skippedCount };
	const BATCH_SIZE = 500;
	for (let i = 0; i < jobRows.length; i += BATCH_SIZE) {
		const chunk = jobRows.slice(i, i + BATCH_SIZE);
		const insert = getExecutor(options.transaction).insert(jobs).values(chunk);
		if (options.requestIds)
			await insert.onConflictDoNothing({ target: jobs.id });
		else await insert;
	}

	// Jobs are picked up by the worker automatically.

	return { jobCount: newItems.length, skippedCount };
}
