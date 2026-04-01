/**
 * Remote Sync Service
 * Handles server-to-server media synchronization
 */

import type {
	ConflictResolutionRequest,
	ConflictResolutionResponse,
	MediaListRequest,
	MediaListResponse,
	MediaMetadataRequest,
	MediaMetadataResponse,
	PullMediaRequest,
	PullMediaResponse,
	PushMediaRequest,
	PushMediaResponse,
	SyncRequest,
	SyncResponse,
} from "@solid-imager/core/domain/media/sync-schemas";
import { logger } from "~/infrastructure/logger";
import { RemoteSyncClient } from "~/infrastructure/remote-sync/remote-sync-client";

/**
 * Remote Sync Service Implementation
 * Provides methods for synchronizing media between servers
 */
export class RemoteSyncServiceImpl {
	private readonly remoteSyncClient: RemoteSyncClient;

	constructor() {
		this.remoteSyncClient = new RemoteSyncClient();
	}

	/**
	 * Initialize remote sync client for a given source ID
	 */
	private async initializeClientForSource(sourceId: string): Promise<void> {
		const { DrizzleSourceRepository } = await import(
			"~/infrastructure/repositories/source-repository"
		);
		const { remoteSourceConnectionInfoSchema } = await import(
			"@solid-imager/core/domain/media/sync-schemas"
		);

		const sourceRepo = new DrizzleSourceRepository();
		const source = await sourceRepo.findById(sourceId);
		if (!source) {
			throw new Error(`Source not found: ${sourceId}`);
		}

		const connectionInfo = remoteSourceConnectionInfoSchema.parse(
			source.connectionInfo,
		);
		this.remoteSyncClient.initialize(connectionInfo.url, sourceId);
	}

	/**
	 * Get media list from remote server
	 */
	async getMediaList(request: MediaListRequest): Promise<MediaListResponse> {
		logger.info({ request }, "Getting media list from remote server");
		await this.initializeClientForSource(request.sourceId);
		try {
			const response = await this.remoteSyncClient.getMediaList(request);
			logger.info(
				{ count: response.media.length, total: response.total },
				"Retrieved media list from remote",
			);
			return response;
		} catch (error) {
			logger.error({ error, request }, "Failed to get media list from remote");
			throw error;
		}
	}

	/**
	 * Get media metadata from remote server
	 */
	async getMediaMetadata(
		request: MediaMetadataRequest,
		sourceId: string,
	): Promise<MediaMetadataResponse> {
		logger.info({ request }, "Getting media metadata from remote server");
		await this.initializeClientForSource(sourceId);
		try {
			const response = await this.remoteSyncClient.getMediaMetadata(request);
			logger.info({ mediaId: response.media.id }, "Retrieved media metadata");
			return response;
		} catch (error) {
			logger.error(
				{ error, request },
				"Failed to get media metadata from remote",
			);
			throw error;
		}
	}

	/**
	 * Push media to remote server
	 */
	async pushMedia(
		request: PushMediaRequest,
		remoteSourceId: string,
	): Promise<PushMediaResponse> {
		logger.info({ request }, "Pushing media to remote server");
		await this.initializeClientForSource(remoteSourceId);
		try {
			const response = await this.remoteSyncClient.pushMedia(request);
			if (response.success) {
				logger.info(
					{ mediaId: request.mediaId, remoteMediaId: response.remoteMediaId },
					"Successfully pushed media to remote",
				);
			} else if (response.conflict) {
				logger.warn(
					{
						mediaId: request.mediaId,
						conflictDetails: response.conflictDetails,
					},
					"Conflict detected while pushing media",
				);
			} else {
				logger.error(
					{ mediaId: request.mediaId, error: response.error },
					"Failed to push media",
				);
			}
			return response;
		} catch (error) {
			logger.error({ error, request }, "Failed to push media to remote");
			throw error;
		}
	}

	/**
	 * Pull media from remote server
	 */
	async pullMedia(
		request: PullMediaRequest,
		remoteSourceId: string,
	): Promise<PullMediaResponse> {
		logger.info({ request }, "Pulling media from remote server");
		await this.initializeClientForSource(remoteSourceId);
		try {
			const response = await this.remoteSyncClient.pullMedia(request);
			if (response.success) {
				logger.info(
					{
						remoteMediaId: request.remoteMediaId,
						localMediaId: response.localMediaId,
					},
					"Successfully pulled media from remote",
				);
			} else if (response.conflict) {
				logger.warn(
					{
						remoteMediaId: request.remoteMediaId,
						conflictDetails: response.conflictDetails,
					},
					"Conflict detected while pulling media",
				);
			} else {
				logger.error(
					{ remoteMediaId: request.remoteMediaId, error: response.error },
					"Failed to pull media",
				);
			}
			return response;
		} catch (error) {
			logger.error({ error, request }, "Failed to pull media from remote");
			throw error;
		}
	}

	/**
	 * Execute bidirectional sync between local and remote sources
	 */
	async sync(request: SyncRequest): Promise<SyncResponse> {
		logger.info({ request }, "Starting bidirectional sync");
		await this.initializeClientForSource(request.remoteSourceId);
		try {
			const response = await this.remoteSyncClient.sync(request);
			logger.info(
				{
					stats: response.stats,
					conflicts: response.conflicts.length,
					errors: response.errors.length,
				},
				"Sync completed",
			);
			return response;
		} catch (error) {
			logger.error({ error, request }, "Failed to execute sync");
			throw error;
		}
	}

	/**
	 * Resolve sync conflict
	 */
	async resolveConflict(
		request: ConflictResolutionRequest,
		remoteSourceId: string,
	): Promise<ConflictResolutionResponse> {
		logger.info({ request }, "Resolving sync conflict");
		await this.initializeClientForSource(remoteSourceId);
		try {
			const response = await this.remoteSyncClient.resolveConflict(request);
			if (response.success) {
				logger.info(
					{ resolvedMediaId: response.resolvedMediaId },
					"Conflict resolved successfully",
				);
			} else {
				logger.error({ error: response.error }, "Failed to resolve conflict");
			}
			return response;
		} catch (error) {
			logger.error({ error, request }, "Failed to resolve conflict");
			throw error;
		}
	}

	/**
	 * Get sync status for a media item
	 */
	async getSyncStatus(mediaId: string, remoteSourceId: string) {
		logger.info({ mediaId }, "Getting sync status");
		await this.initializeClientForSource(remoteSourceId);
		try {
			const status = await this.remoteSyncClient.getSyncStatus(mediaId);
			logger.info({ mediaId, status }, "Retrieved sync status");
			return status;
		} catch (error) {
			logger.error({ error, mediaId }, "Failed to get sync status");
			throw error;
		}
	}

	/**
	 * Get sync status for all media in a source
	 */
	async getSourceSyncStatus(sourceId: string, remoteSourceId: string) {
		logger.info({ sourceId }, "Getting source sync status");
		await this.initializeClientForSource(remoteSourceId);
		try {
			const status = await this.remoteSyncClient.getSourceSyncStatus(sourceId);
			logger.info({ sourceId, status }, "Retrieved source sync status");
			return status;
		} catch (error) {
			logger.error({ error, sourceId }, "Failed to get source sync status");
			throw error;
		}
	}
}

// Export singleton instance
export const RemoteSyncService = new RemoteSyncServiceImpl();
