/**
 * Diff Detector Service
 * Detects differences between local and remote media for synchronization
 */

import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { logger } from "~/infrastructure/logger";

/**
 * Media diff information
 */
export interface MediaDiff {
	/** Media ID */
	mediaId: string;
	/** File path relative to source */
	filePath: string;
	/** MD5 hash of the file */
	hashMd5: string | null;
	/** Last modified timestamp */
	modifiedAt: Date;
	/** File size in bytes */
	fileSize: number | null;
}

/**
 * Diff result between local and remote
 */
export interface DiffResult {
	/** Media that exist only locally (need to push) */
	localOnly: MediaDiff[];
	/** Media that exist only remotely (need to pull) */
	remoteOnly: MediaDiff[];
	/** Media that exist in both but differ (conflict or update) */
	conflicts: {
		local: MediaDiff;
		remote: MediaDiff;
		difference: "hash" | "timestamp" | "both";
	}[];
	/** Media that are identical (no action needed) */
	identical: MediaDiff[];
}

/**
 * Diff Detector Service Implementation
 */
export class DiffDetectorServiceImpl {
	private readonly mediaRepository: IMediaRepository;
	private readonly sourceRepository: SourceRepository;

	constructor(
		mediaRepository: IMediaRepository,
		sourceRepository: SourceRepository,
	) {
		this.mediaRepository = mediaRepository;
		this.sourceRepository = sourceRepository;
	}

	/**
	 * Detect differences between local and remote media
	 */
	async detectDiffs(
		localSourceId: string,
		remoteMediaList: MediaDiff[],
	): Promise<DiffResult> {
		logger.info(
			{
				localSourceId,
				remoteCount: remoteMediaList.length,
			},
			"Starting diff detection",
		);

		// Get all local media for the source
		const localMedia = await this.getLocalMediaForSource(localSourceId);
		logger.info({ localCount: localMedia.length }, "Retrieved local media");

		// Create maps for efficient lookup
		const localByPath = new Map<string, MediaDiff>();
		const localByHash = new Map<string, MediaDiff[]>();
		const remoteByPath = new Map<string, MediaDiff>();

		for (const media of localMedia) {
			localByPath.set(media.filePath, media);
			if (media.hashMd5) {
				const existing = localByHash.get(media.hashMd5) || [];
				existing.push(media);
				localByHash.set(media.hashMd5, existing);
			}
		}

		for (const media of remoteMediaList) {
			remoteByPath.set(media.filePath, media);
		}

		const result: DiffResult = {
			localOnly: [],
			remoteOnly: [],
			conflicts: [],
			identical: [],
		};

		// Check local media against remote
		for (const local of localMedia) {
			const remote = remoteByPath.get(local.filePath);

			if (!remote) {
				// Local only - need to push
				result.localOnly.push(local);
				continue;
			}

			// Compare by hash if available
			if (local.hashMd5 && remote.hashMd5) {
				if (local.hashMd5 === remote.hashMd5) {
					// Identical by hash
					result.identical.push(local);
				} else {
					// Different hash - conflict
					result.conflicts.push({
						local,
						remote,
						difference: "hash",
					});
				}
			} else {
				// No hash available - compare by timestamp
				const localTime = local.modifiedAt.getTime();
				const remoteTime = remote.modifiedAt.getTime();

				if (Math.abs(localTime - remoteTime) < 1000) {
					// Within 1 second - consider identical
					result.identical.push(local);
				} else {
					// Different timestamps - conflict
					result.conflicts.push({
						local,
						remote,
						difference: "timestamp",
					});
				}
			}
		}

		// Check remote media not found locally
		for (const remote of remoteMediaList) {
			if (!localByPath.has(remote.filePath)) {
				// Remote only - need to pull
				result.remoteOnly.push(remote);
			}
		}

		logger.info(
			{
				localOnly: result.localOnly.length,
				remoteOnly: result.remoteOnly.length,
				conflicts: result.conflicts.length,
				identical: result.identical.length,
			},
			"Diff detection completed",
		);

		return result;
	}

	/**
	 * Get local media information for diff detection
	 */
	private async getLocalMediaForSource(sourceId: string): Promise<MediaDiff[]> {
		const media = await this.mediaRepository.findAllBySourceId(sourceId);

		return media.map((m: Media) => ({
			mediaId: m.id,
			filePath: m.filePath,
			hashMd5: null, // Will be populated from technical info if available
			modifiedAt: m.modifiedAt,
			fileSize: m.fileSize,
		}));
	}

	/**
	 * Calculate MD5 hash for a file
	 * This is a placeholder - actual implementation will depend on file storage
	 */
	async calculateFileHash(filePath: string): Promise<string> {
		// TODO: Implement file hash calculation
		// This should read the file and calculate MD5 hash
		logger.warn({ filePath }, "File hash calculation not implemented");
		return "";
	}
}
