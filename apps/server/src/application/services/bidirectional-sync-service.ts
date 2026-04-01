/**
 * Bidirectional Sync Service
 * Orchestrates bidirectional synchronization between local and remote sources
 */

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { ConflictResolutionPolicy } from "@solid-imager/core/domain/media/conflict-resolution";
import { ConflictResolverService } from "@solid-imager/core/domain/media/conflict-resolution";
import type { MediaMetadataContext } from "@solid-imager/core/domain/media/schemas";
import type {
	SyncRequest,
	SyncResponse,
} from "@solid-imager/core/domain/media/sync-schemas";
import { remoteSourceConnectionInfoSchema } from "@solid-imager/core/domain/media/sync-schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import {
	DiffDetectorServiceImpl,
	type DiffResult,
	type MediaDiff,
} from "~/application/services/diff-detector-service";
import { MediaProcessingService } from "~/application/services/media-processing-service";
import type { AppRouter } from "~/domain/shared/api-contract";
import type { MediaSource as DbMediaSource } from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";
import { getDriver } from "~/infrastructure/storage/factory";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

/**
 * Sync statistics
 */
export interface SyncStats {
	totalMedia: number;
	pushed: number;
	pulled: number;
	conflicts: number;
	errors: number;
}

/**
 * Create an oRPC client for a remote server
 */
function createRemoteClient(baseUrl: string): any {
	const rpcUrl = new URL("/api/rpc/", baseUrl).toString();
	const link = new RPCLink({
		url: rpcUrl,
		fetch: fetch,
	});
	return createORPCClient(link);
}

/**
 * Bidirectional Sync Service Implementation
 */
export class BidirectionalSyncServiceImpl {
	private readonly diffDetector: DiffDetectorServiceImpl;
	private readonly conflictResolver: ConflictResolverService;
	private readonly mediaRepository: IMediaRepository;
	private readonly sourceRepository: SourceRepository;

	constructor(
		mediaRepository: IMediaRepository,
		sourceRepository: SourceRepository,
	) {
		this.mediaRepository = mediaRepository;
		this.sourceRepository = sourceRepository;
		this.diffDetector = new DiffDetectorServiceImpl(
			mediaRepository,
			sourceRepository,
		);
		this.conflictResolver = new ConflictResolverService();
	}

	/**
	 * Execute bidirectional sync
	 */
	async sync(request: SyncRequest): Promise<SyncResponse> {
		const startTime = Date.now();
		logger.info(
			{
				localSourceId: request.localSourceId,
				remoteSourceId: request.remoteSourceId,
				direction: request.direction,
				conflictResolution: request.conflictResolution,
				dryRun: request.dryRun,
			},
			"Starting bidirectional sync",
		);

		try {
			// Resolve remote server URL from source connection info
			const remoteClient = await this.getRemoteClient(request.remoteSourceId);

			// Step 1: Get remote media list
			const remoteMediaList = await this.getRemoteMediaList(
				remoteClient,
				request.remoteSourceId,
			);

			// Step 2: Detect differences
			const diffResult = await this.diffDetector.detectDiffs(
				request.localSourceId,
				remoteMediaList,
			);

			// Step 3: Execute sync based on direction
			const stats = await this.executeSync(request, diffResult, remoteClient);

			const duration = Date.now() - startTime;
			logger.info(
				{
					stats,
					duration: `${duration}ms`,
				},
				"Bidirectional sync completed",
			);

			return {
				success: true,
				stats,
				conflicts: [],
				errors: [],
			};
		} catch (error) {
			logger.error({ error, request }, "Bidirectional sync failed");
			throw error;
		}
	}

	/**
	 * Create an oRPC client for the remote source
	 */
	private async getRemoteClient(
		remoteSourceId: string,
	): Promise<RouterClient<AppRouter>> {
		const source = await this.sourceRepository.findById(remoteSourceId);
		if (!source) {
			throw new Error(`Remote source not found: ${remoteSourceId}`);
		}

		const connectionInfo = remoteSourceConnectionInfoSchema.parse(
			source.connectionInfo,
		);
		return createRemoteClient(connectionInfo.url);
	}

	/**
	 * Get remote media list via oRPC with pagination
	 */
	private async getRemoteMediaList(
		remoteClient: RouterClient<AppRouter>,
		remoteSourceId: string,
	): Promise<MediaDiff[]> {
		const allMedia: MediaDiff[] = [];
		let offset = 0;
		const limit = 100;
		let hasMore = true;

		while (hasMore) {
			const result = await remoteClient.media.search({
				sourceId: remoteSourceId,
				params: { limit, offset },
			});

			const mediaDiffs = result.media.map(
				(m: {
					id: string;
					filePath: string;
					modifiedAt: string | Date;
					fileSize: number | null;
				}) => ({
					mediaId: m.id,
					filePath: m.filePath,
					hashMd5: null,
					modifiedAt: new Date(m.modifiedAt),
					fileSize: m.fileSize ?? null,
				}),
			);

			allMedia.push(...mediaDiffs);

			hasMore = result.media.length === limit;
			offset += limit;
		}

		return allMedia;
	}

	/**
	 * Execute sync operations based on direction
	 */
	private async executeSync(
		request: SyncRequest,
		diffResult: DiffResult,
		remoteClient: RouterClient<AppRouter>,
	): Promise<SyncStats> {
		const stats: SyncStats = {
			totalMedia:
				diffResult.localOnly.length +
				diffResult.remoteOnly.length +
				diffResult.conflicts.length +
				diffResult.identical.length,
			pushed: 0,
			pulled: 0,
			conflicts: 0,
			errors: 0,
		};

		// Handle local-only media (push)
		if (request.direction === "push" || request.direction === "bidirectional") {
			for (const media of diffResult.localOnly) {
				try {
					if (!request.dryRun) {
						await this.pushMedia(
							media.mediaId,
							request.remoteSourceId,
							remoteClient,
						);
					}
					stats.pushed++;
					logger.debug({ mediaId: media.mediaId }, "Pushed media");
				} catch (error) {
					stats.errors++;
					logger.error(
						{ error, mediaId: media.mediaId },
						"Failed to push media",
					);
				}
			}
		}

		// Handle remote-only media (pull)
		if (request.direction === "pull" || request.direction === "bidirectional") {
			for (const media of diffResult.remoteOnly) {
				try {
					if (!request.dryRun) {
						await this.pullMedia(
							media.mediaId,
							request.localSourceId,
							remoteClient,
						);
					}
					stats.pulled++;
					logger.debug({ mediaId: media.mediaId }, "Pulled media");
				} catch (error) {
					stats.errors++;
					logger.error(
						{ error, mediaId: media.mediaId },
						"Failed to pull media",
					);
				}
			}
		}

		// Handle conflicts
		for (const conflict of diffResult.conflicts) {
			try {
				const resolution = this.conflictResolver.resolveConflict(
					{
						id: `${conflict.local.mediaId}-${conflict.remote.mediaId}`,
						localMediaId: conflict.local.mediaId,
						remoteMediaId: conflict.remote.mediaId,
						localFilePath: conflict.local.filePath,
						remoteFilePath: conflict.remote.filePath,
						localModifiedAt: conflict.local.modifiedAt,
						remoteModifiedAt: conflict.remote.modifiedAt,
						localHash: conflict.local.hashMd5,
						remoteHash: conflict.remote.hashMd5,
						conflictType:
							conflict.difference === "hash"
								? "hash_mismatch"
								: conflict.difference === "timestamp"
									? "timestamp_mismatch"
									: "both_mismatch",
						resolved: false,
					},
					request.conflictResolution as ConflictResolutionPolicy,
				);

				if (resolution.success) {
					if (!request.dryRun) {
						await this.executeResolution(resolution, request, remoteClient);
					}
					stats.conflicts++;
					logger.debug(
						{
							localMediaId: conflict.local.mediaId,
							remoteMediaId: conflict.remote.mediaId,
							action: resolution.action,
						},
						"Resolved conflict",
					);
				} else {
					stats.errors++;
					logger.warn(
						{
							localMediaId: conflict.local.mediaId,
							remoteMediaId: conflict.remote.mediaId,
							error: resolution.error,
						},
						"Conflict requires manual resolution",
					);
				}
			} catch (error) {
				stats.errors++;
				logger.error(
					{
						error,
						localMediaId: conflict.local.mediaId,
						remoteMediaId: conflict.remote.mediaId,
					},
					"Failed to resolve conflict",
				);
			}
		}

		return stats;
	}

	/**
	 * Push media to remote server via oRPC
	 */
	private async pushMedia(
		mediaId: string,
		targetSourceId: string,
		remoteClient: RouterClient<AppRouter>,
		metadataOverride?: {
			tags?: Array<{
				name: string;
				type?: "positive" | "negative";
				confidence?: number | null;
			}>;
			authors?: Array<{ name: string; accountId?: string | null }>;
			characters?: Array<{ name: string; confidence?: number | null }>;
			ips?: Array<{ name: string; confidence?: number | null }>;
		},
	) {
		// Get local source for file access
		const localMedia = await this.mediaRepository.findById(mediaId);
		if (!localMedia) {
			throw new Error(`Media not found: ${mediaId}`);
		}

		const localSource = await this.sourceRepository.findById(
			localMedia.mediaSourceId,
		);
		if (!localSource) {
			throw new Error(`Local source not found: ${localMedia.mediaSourceId}`);
		}

		// Read file from local storage
		const driver = getDriver(localSource as unknown as DbMediaSource);
		const fileContent = await driver.get(localMedia.filePath);

		// Get full metadata
		const details = await this.mediaRepository.getDetails(mediaId);

		// Create File object for oRPC upload
		const ext = localMedia.fileName.split(".").pop()?.toLowerCase() ?? "bin";
		const mimeMap: Record<string, string> = {
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			webp: "image/webp",
			mp4: "video/mp4",
			webm: "video/webm",
			mp3: "audio/mpeg",
		};
		const file = new File([new Uint8Array(fileContent)], localMedia.fileName, {
			type: mimeMap[ext] ?? "application/octet-stream",
		});

		// Push file + metadata to remote
		const result = await remoteClient.sync.pushMediaFile({
			file,
			targetSourceId,
			fileName: localMedia.fileName,
			description: details?.description,
			createdAt: localMedia.createdAt,
			sourceUrls: details?.urls.map((u: any) => u.url),
			authors:
				metadataOverride?.authors ??
				details?.authors.map((a: any) => ({
					name: a.name,
					accountId: a.accountId,
				})),
			tags:
				metadataOverride?.tags ??
				details?.tags.map((t: any) => ({
					name: t.name,
					type: t.type,
					confidence: t.confidence,
				})),
			characters:
				metadataOverride?.characters ??
				details?.characters.map((c: any) => ({
					name: c.name,
					confidence: c.confidence,
				})),
			ips:
				metadataOverride?.ips ??
				details?.ips.map((ip: any) => ({
					name: ip.name,
					confidence: ip.confidence,
				})),
			generationInfo: details?.generationInfo
				? {
						prompt: details.generationInfo.prompt,
						negativePrompt: details.generationInfo.negativePrompt,
						modelName: details.generationInfo.modelName,
						seed: details.generationInfo.seed,
						steps: details.generationInfo.steps,
						cfgScale: details.generationInfo.cfgScale,
						aiGenerated: details.generationInfo.aiGenerated,
					}
				: null,
		});

		if (!result.success) {
			throw new Error(result.error ?? "Push failed");
		}
	}

	/**
	 * Pull media from remote server via oRPC
	 */
	private async pullMedia(
		remoteMediaId: string,
		targetSourceId: string,
		remoteClient: RouterClient<AppRouter>,
	) {
		// Get target source info
		const targetSource = await this.sourceRepository.findById(targetSourceId);
		if (!targetSource || targetSource.type !== "local") {
			throw new Error(
				`Target source not found or not local: ${targetSourceId}`,
			);
		}

		// Get remote source ID via global search
		const searchResult = await remoteClient.media.search({
			sourceId: null,
			params: { limit: 1, offset: 0 },
		});
		const remoteMedia = searchResult.media.find(
			(m: { id: string }) => m.id === remoteMediaId,
		);
		if (!remoteMedia) {
			throw new Error(`Remote media not found: ${remoteMediaId}`);
		}

		// Get remote source ID from the found media
		const remoteDetails = await remoteClient.media.getDetails({
			sourceId: remoteMedia.mediaSourceId,
			mediaId: remoteMediaId,
		});

		if (!remoteDetails) {
			throw new Error(`Remote media not found: ${remoteMediaId}`);
		}

		// Pull file + metadata from remote
		const pullResult = await remoteClient.sync.pullMediaFile({
			mediaId: remoteMediaId,
			sourceId: remoteDetails.mediaSourceId,
		});

		if (!pullResult.success || !pullResult.fileData) {
			throw new Error(pullResult.error ?? "Pull failed");
		}

		// Decode base64 file data
		const fileBuffer = Buffer.from(pullResult.fileData, "base64");

		// Save to local storage
		const basePath = (targetSource.connectionInfo as { path: string }).path;
		const fileName = pullResult.fileName ?? remoteDetails.fileName;

		const fileInfo = await ServerMediaStorage.saveFile(
			basePath,
			{
				name: fileName,
				arrayBuffer: async () => fileBuffer,
			},
			{
				filename: fileName,
				overwrite: false,
				autoIncrement: true,
			},
		);

		// Register with full metadata using the unified registration flow
		const contextMetadata: Partial<MediaMetadataContext> = {
			description: pullResult.description,
			createdAt: pullResult.createdAt,
			sourceUrls: pullResult.sourceUrls,
			authors: pullResult.authors,
			tags: pullResult.tags,
			characters: pullResult.characters,
			ips: pullResult.ips,
			generationInfo: pullResult.generationInfo,
		};

		await MediaProcessingService.registerAndProcess(
			targetSourceId,
			fileInfo.filePath,
			contextMetadata,
		);

		logger.info(
			{ remoteMediaId, filePath: fileInfo.filePath },
			"Pulled and registered media from remote",
		);
	}

	/**
	 * Execute conflict resolution action
	 */
	private async executeResolution(
		resolution: {
			action: string;
			conflict: {
				localMediaId: string;
				remoteMediaId: string;
			};
		},
		request: SyncRequest,
		remoteClient: RouterClient<AppRouter>,
	) {
		switch (resolution.action) {
			case "kept_local":
				await this.pushMedia(
					resolution.conflict.localMediaId,
					request.remoteSourceId,
					remoteClient,
				);
				break;
			case "kept_remote":
				await this.pullMedia(
					resolution.conflict.remoteMediaId,
					request.localSourceId,
					remoteClient,
				);
				break;
			case "merged": {
				// Merge metadata: keep local file, combine metadata from both sides
				const localDetails = await this.mediaRepository.getDetails(
					resolution.conflict.localMediaId,
				);
				const remoteDetails = await remoteClient.media.getDetails({
					sourceId: request.remoteSourceId,
					mediaId: resolution.conflict.remoteMediaId,
				});

				// Merge tags, authors, characters, ips
				const mergedTags = this.mergeMetadata(
					localDetails?.tags ?? [],
					remoteDetails.tags ?? [],
					(item) => `${item.name}:${item.type ?? ""}`,
				);
				const mergedAuthors = this.mergeMetadata(
					localDetails?.authors ?? [],
					remoteDetails.authors ?? [],
					(item) => item.name,
				);
				const mergedCharacters = this.mergeMetadata(
					localDetails?.characters ?? [],
					remoteDetails.characters ?? [],
					(item) => item.name,
				);
				const mergedIps = this.mergeMetadata(
					localDetails?.ips ?? [],
					remoteDetails.ips ?? [],
					(item) => item.name,
				);

				// Use local file but merged metadata
				await this.pushMedia(
					resolution.conflict.localMediaId,
					request.remoteSourceId,
					remoteClient,
					{
						tags: mergedTags,
						authors: mergedAuthors,
						characters: mergedCharacters,
						ips: mergedIps,
					},
				);
				break;
			}
			case "skipped":
				break;
			case "manual_required":
				logger.info(
					{
						localMediaId: resolution.conflict.localMediaId,
						remoteMediaId: resolution.conflict.remoteMediaId,
					},
					"Conflict marked for manual resolution",
				);
				break;
		}
	}

	/**
	 * Merge two metadata arrays, removing duplicates based on a key function
	 */
	private mergeMetadata<T>(
		local: T[],
		remote: T[],
		keyFn: (item: T) => string,
	): T[] {
		const merged = new Map<string, T>();
		for (const item of local) {
			merged.set(keyFn(item), item);
		}
		for (const item of remote) {
			const key = keyFn(item);
			if (!merged.has(key)) {
				merged.set(key, item);
			}
		}
		return Array.from(merged.values());
	}
}
