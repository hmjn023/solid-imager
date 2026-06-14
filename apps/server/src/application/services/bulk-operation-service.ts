import { updateMediaRequestSchema } from "@solid-imager/core/domain/media/schemas";
import { services } from "~/application/registry";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

/**
 * BulkOperationService - バルク操作機能
 * Feature 15: バルク操作機能
 */

export const BulkOperationService = {
	/**
	 * Performs a bulk edit on multiple media items within a specific source.
	 * @param {string} mediaSourceId - The ID of the media source.
	 * @param {string[]} mediaIds - An array of media IDs to be edited.
	 * @param {unknown} updates - An object containing the fields to update and their new values.
	 */
	async bulkEditMedia(
		mediaSourceId: string,
		mediaIds: string[],
		updates: unknown,
	) {
		const parsedUpdates = updateMediaRequestSchema.parse(updates);
		const mediaRepo = services.getMediaRepository();

		// セキュリティ及び整合性チェック
		for (const mediaId of mediaIds) {
			const media = await mediaRepo.findById(mediaId);
			if (!media || media.mediaSourceId !== mediaSourceId) {
				throw new Error(
					`Media with ID ${mediaId} does not belong to source ${mediaSourceId}`,
				);
			}
		}

		await mediaRepo.bulkUpdate(mediaIds, parsedUpdates);
	},

	/**
	 * Performs a bulk delete operation on multiple media items within a specific source.
	 * @param {string} mediaSourceId - The ID of the media source.
	 * @param {string[]} mediaIds - An array of media IDs to be deleted.
	 */
	async bulkDeleteMedia(mediaSourceId: string, mediaIds: string[]) {
		const mediaRepo = services.getMediaRepository();
		const mediaStorage = services.getMediaStorage();
		const sourceRepo = services.getSourceRepository();

		const source = await sourceRepo.findById(mediaSourceId);
		if (!source) {
			throw new Error(`Media source not found: ${mediaSourceId}`);
		}
		const basePath = (source.connectionInfo as { path: string }).path;

		const validMediaIds: string[] = [];
		for (const mediaId of mediaIds) {
			const media = await mediaRepo.findById(mediaId);
			if (media && media.mediaSourceId === mediaSourceId) {
				validMediaIds.push(mediaId);
				// 実ファイルの削除
				try {
					await mediaStorage.deleteFile(basePath, media.filePath);
				} catch (e) {
					logger.warn(
						{ mediaId, filePath: media.filePath, error: e },
						"Failed to delete file from storage during bulk delete",
					);
				}
				// サムネイルの削除
				try {
					await deleteThumbnail(mediaSourceId, media.id);
				} catch (e) {
					logger.warn(
						{ mediaId, error: e },
						"Failed to delete thumbnail during bulk delete",
					);
				}
			}
		}

		if (validMediaIds.length > 0) {
			await mediaRepo.bulkDelete(validMediaIds);
		}
	},

	/**
	 * Performs a bulk move operation on multiple media items to a new destination path.
	 * @param {string} mediaSourceId - The ID of the media source.
	 * @param {string[]} mediaIds - An array of media IDs to be moved.
	 * @param {string} destinationPath - The target path where the media items will be moved.
	 */
	async bulkMoveMedia(
		mediaSourceId: string,
		mediaIds: string[],
		destinationPath: string,
	) {
		const mediaRepo = services.getMediaRepository();
		const mediaStorage = services.getMediaStorage();
		const sourceRepo = services.getSourceRepository();

		const source = await sourceRepo.findById(mediaSourceId);
		if (!source) {
			throw new Error(`Media source not found: ${mediaSourceId}`);
		}
		const basePath = (source.connectionInfo as { path: string }).path;

		const pathUpdates: { id: string; filePath: string; fileName: string }[] =
			[];

		for (const mediaId of mediaIds) {
			const media = await mediaRepo.findById(mediaId);
			if (media && media.mediaSourceId === mediaSourceId) {
				const cleanDestDir = destinationPath.endsWith("/")
					? destinationPath
					: `${destinationPath}/`;
				const newFilePath = `${cleanDestDir}${media.fileName}`;

				if (newFilePath !== media.filePath) {
					try {
						// ファイルを物理的に移動
						await mediaStorage.moveFile(basePath, media.filePath, newFilePath);
						pathUpdates.push({
							id: media.id,
							filePath: newFilePath,
							fileName: media.fileName,
						});
					} catch (e) {
						logger.error(
							{ mediaId, filePath: media.filePath, newFilePath, error: e },
							"Failed to move file in storage during bulk move",
						);
					}
				}
			}
		}

		if (pathUpdates.length > 0) {
			await mediaRepo.bulkUpdatePaths(pathUpdates);
		}
	},

	/**
	 * Performs a bulk tagging operation on multiple media items, adding and/or removing specified tags.
	 * @param {string} mediaSourceId - The ID of the media source.
	 * @param {string[]} mediaIds - An array of media IDs to be tagged.
	 * @param {string[]} tagsToAdd - An array of tag IDs to add to the media items.
	 * @param {string[]} tagsToRemove - An array of tag IDs to remove from the media items.
	 */
	async bulkTagMedia(
		mediaSourceId: string,
		mediaIds: string[],
		tagsToAdd: string[],
		tagsToRemove: string[],
	) {
		const mediaRepo = services.getMediaRepository();

		// セキュリティ及び整合性チェック
		for (const mediaId of mediaIds) {
			const media = await mediaRepo.findById(mediaId);
			if (!media || media.mediaSourceId !== mediaSourceId) {
				throw new Error(
					`Media with ID ${mediaId} does not belong to source ${mediaSourceId}`,
				);
			}
		}

		if (tagsToRemove.length > 0) {
			await mediaRepo.bulkRemoveTags(mediaIds, tagsToRemove);
		}
		if (tagsToAdd.length > 0) {
			await mediaRepo.bulkAddTags(mediaIds, tagsToAdd);
		}
	},

	/**
	 * Performs a bulk copy operation to copy multiple media items to a target media source.
	 */
	async bulkCopyToSource(
		mediaSourceId: string,
		mediaIds: string[],
		targetSourceId: string,
	) {
		const mediaRepo = services.getMediaRepository();
		const { MediaService } = await import(
			"~/application/services/media-service"
		);

		// セキュリティチェック
		for (const mediaId of mediaIds) {
			const media = await mediaRepo.findById(mediaId);
			if (!media || media.mediaSourceId !== mediaSourceId) {
				throw new Error(
					`Media with ID ${mediaId} does not belong to source ${mediaSourceId}`,
				);
			}
		}

		const { asyncPool } = await import("@solid-imager/core/utils/async-pool");
		const processCopy = async (mediaId: string) => {
			await MediaService.copyMedia(mediaId, targetSourceId);
		};

		const poolResults = await asyncPool(mediaIds, 5, processCopy);
		const failures = poolResults.filter((r) => r.status === "rejected");
		if (failures.length > 0) {
			logger.error(
				{ failures },
				"Some copy operations failed during bulk copy",
			);
			throw new Error(`Failed to copy ${failures.length} media items.`);
		}
	},

	/**
	 * Performs a bulk move operation to move multiple media items to a target media source.
	 */
	async bulkMoveToSource(
		mediaSourceId: string,
		mediaIds: string[],
		targetSourceId: string,
	) {
		const mediaRepo = services.getMediaRepository();
		const { MediaService } = await import(
			"~/application/services/media-service"
		);

		// セキュリティチェック
		for (const mediaId of mediaIds) {
			const media = await mediaRepo.findById(mediaId);
			if (!media || media.mediaSourceId !== mediaSourceId) {
				throw new Error(
					`Media with ID ${mediaId} does not belong to source ${mediaSourceId}`,
				);
			}
		}

		const { asyncPool } = await import("@solid-imager/core/utils/async-pool");
		const processMove = async (mediaId: string) => {
			await MediaService.moveMedia(mediaId, targetSourceId);
		};

		const poolResults = await asyncPool(mediaIds, 5, processMove);
		const failures = poolResults.filter((r) => r.status === "rejected");
		if (failures.length > 0) {
			logger.error(
				{ failures },
				"Some move operations failed during bulk move",
			);
			throw new Error(`Failed to move ${failures.length} media items.`);
		}
	},
};
