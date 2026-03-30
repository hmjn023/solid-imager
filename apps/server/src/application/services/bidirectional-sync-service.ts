/**
 * Bidirectional Sync Service
 * Orchestrates bidirectional synchronization between local and remote sources
 */

import type { ConflictResolutionPolicy } from "@solid-imager/core/domain/media/conflict-resolution";
import { ConflictResolverService } from "@solid-imager/core/domain/media/conflict-resolution";
import type {
	SyncRequest,
	SyncResponse,
} from "@solid-imager/core/domain/media/sync-schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import {
	DiffDetectorServiceImpl,
	type DiffResult,
} from "~/application/services/diff-detector-service";
import { logger } from "~/infrastructure/logger";
import { RemoteSyncClient } from "~/infrastructure/remote-sync/remote-sync-client";

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
 * Bidirectional Sync Service Implementation
 */
export class BidirectionalSyncServiceImpl {
	private readonly diffDetector: DiffDetectorServiceImpl;
	private readonly conflictResolver: ConflictResolverService;
	private readonly remoteSyncClient: RemoteSyncClient;
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
		this.remoteSyncClient = new RemoteSyncClient();
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
			// Step 1: Get remote media list
			const remoteMediaList = await this.getRemoteMediaList(
				request.remoteSourceId,
			);

			// Step 2: Detect differences
			const diffResult = await this.diffDetector.detectDiffs(
				request.localSourceId,
				remoteMediaList,
			);

			// Step 3: Execute sync based on direction
			const stats = await this.executeSync(request, diffResult);

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
	 * Get remote media list
	 */
	private async getRemoteMediaList(remoteSourceId: string) {
		// TODO: Implement remote media list retrieval
		// This should call the remote server's API
		logger.warn(
			{ remoteSourceId },
			"Remote media list retrieval not implemented",
		);
		return [];
	}

	/**
	 * Execute sync operations based on direction
	 */
	private async executeSync(
		request: SyncRequest,
		diffResult: DiffResult,
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
						await this.pushMedia(media.mediaId, request.remoteSourceId);
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
						await this.pullMedia(media.mediaId, request.localSourceId);
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
						// Execute the resolution action
						await this.executeResolution(resolution, request);
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
	 * Push media to remote server
	 */
	private async pushMedia(mediaId: string, targetSourceId: string) {
		// TODO: Implement media push
		// This should:
		// 1. Get media file from local storage
		// 2. Get media metadata
		// 3. Upload to remote server
		// 4. Update sync status
		logger.warn({ mediaId, targetSourceId }, "Media push not implemented");
	}

	/**
	 * Pull media from remote server
	 */
	private async pullMedia(remoteMediaId: string, targetSourceId: string) {
		// TODO: Implement media pull
		// This should:
		// 1. Get media file from remote server
		// 2. Get media metadata from remote server
		// 3. Save to local storage
		// 4. Create media record
		// 5. Update sync status
		logger.warn(
			{ remoteMediaId, targetSourceId },
			"Media pull not implemented",
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
	) {
		switch (resolution.action) {
			case "kept_local":
				// Push local version to remote
				await this.pushMedia(
					resolution.conflict.localMediaId,
					request.remoteSourceId,
				);
				break;
			case "kept_remote":
				// Pull remote version to local
				await this.pullMedia(
					resolution.conflict.remoteMediaId,
					request.localSourceId,
				);
				break;
			case "merged":
				// TODO: Implement merge logic
				logger.warn("Merge resolution not implemented");
				break;
			case "skipped":
				// No action needed
				break;
			case "manual_required":
				// Mark for manual resolution
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
}
