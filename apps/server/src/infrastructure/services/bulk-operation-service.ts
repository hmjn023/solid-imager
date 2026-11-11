import type { IMediaService } from "@solid-imager/application/media";
import { UnreconciledStorageError } from "@solid-imager/core/errors";
import {
	type BulkMediaItemResult,
	type BulkMediaOperationResult,
	type MediaBulkRepository,
	type MediaReader,
	type UpdateMediaRequestInput,
	updateMediaRequestSchema,
} from "@solid-imager/core/media";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";

function getBulkMediaRepository(): MediaBulkRepository &
	Pick<MediaReader, "findByIds"> {
	return services.getMediaRepository();
}

/** Validate the entire source group before performing any side effect. */
async function preflight(mediaSourceId: string, mediaIds: string[]) {
	const mediaList = await getBulkMediaRepository().findByIds(mediaIds);
	const mediaMap = new Map(mediaList.map((media) => [media.id, media]));
	return {
		mediaMap,
		invalid: new Set(
			mediaIds.filter(
				(id) => mediaMap.get(id)?.mediaSourceId !== mediaSourceId,
			),
		),
	};
}
function rejectedGroup(
	mediaIds: string[],
	invalid: Set<string>,
): BulkMediaOperationResult {
	return {
		success: false,
		items: mediaIds.map((mediaId) =>
			invalid.has(mediaId)
				? {
						mediaId,
						status: "failed",
						error: "指定されたソースのメディアを確認できません。",
					}
				: {
						mediaId,
						status: "not_processed",
						error: "対象確認に失敗したため実行していません。",
					},
		),
	};
}
async function transferItems(
	mediaSourceId: string,
	inputIds: string[],
	perform: (mediaId: string) => Promise<unknown>,
): Promise<BulkMediaOperationResult> {
	const mediaIds = [...new Set(inputIds)];
	const { invalid } = await preflight(mediaSourceId, mediaIds);
	if (invalid.size) return rejectedGroup(mediaIds, invalid);
	const { asyncPool } = await import("@solid-imager/core/utils");
	const results = await asyncPool(mediaIds, 5, perform);
	const items: BulkMediaItemResult[] = results.map((result, index) => {
		const mediaId = mediaIds[index];
		if (result.status === "fulfilled") return { mediaId, status: "succeeded" };
		logger.error({ mediaId, err: result.reason }, "Bulk media transfer failed");
		if (result.reason instanceof UnreconciledStorageError)
			return {
				mediaId,
				status: "failed",
				retryable: false,
				error:
					"コピー・移動の復旧を確認できません。再送せず保存先を確認してください。",
			};
		return {
			mediaId,
			status: "failed",
			error: "メディアのコピー・移動に失敗しました。",
		};
	});
	return { success: items.every((item) => item.status === "succeeded"), items };
}

/** Commit one transfer and its processing reservations before publishing notifications. */
async function commitTransfer(
	mediaId: string,
	targetSourceId: string,
	transfer: IMediaService["copyMedia"],
	afterCommit: (
		actions: NonNullable<
			Awaited<ReturnType<IMediaService["copyMedia"]>>["deferred"]
		>,
	) => Promise<void>,
) {
	let copiedPath: string | undefined;
	let transactionWorkComplete = false;
	let result;
	try {
		result = await db.transaction(async (tx) => {
			const transferred = await transfer(mediaId, targetSourceId, tx);
			if (!transferred.success)
				throw new Error("Media transfer did not complete.");
			copiedPath = transferred.media.filePath;
			for (const group of transferred.deferred?.jobs ?? []) {
				for (const job of group.jobs) {
					await tx.insert(jobs).values({
						type: job.type,
						mediaSourceId: group.mediaSourceId,
						payload: {
							...(job.payload &&
							typeof job.payload === "object" &&
							!Array.isArray(job.payload)
								? job.payload
								: {}),
							mediaId: job.mediaId,
							sourcePath: job.sourcePath,
						},
					});
				}
			}
			transactionWorkComplete = true;
			return transferred;
		});
	} catch (err) {
		// Once the callback finishes, a rejected COMMIT acknowledgement cannot
		// prove rollback. Keep a possibly committed file intact for reconciliation.
		if (transactionWorkComplete) throw new UnreconciledStorageError([err]);
		if (copiedPath) {
			try {
				const target = await services
					.getSourceRepository()
					.findById(targetSourceId);
				if (target?.type !== "local")
					throw new Error(
						"The copied file's local destination is no longer available.",
					);
				const { localConnectionSchema } =
					await import("@solid-imager/core/sources");
				await services
					.getMediaStorage()
					.deleteFile(
						localConnectionSchema.parse(target.connectionInfo).path,
						copiedPath,
					);
			} catch (cleanupError) {
				logger.error(
					{ mediaId, err: cleanupError },
					"Failed to clean up uncommitted bulk transfer",
				);
				throw new UnreconciledStorageError([err, cleanupError]);
			}
		}
		throw err;
	}
	if (result.deferred) {
		try {
			await afterCommit({ ...result.deferred, jobs: [] });
		} catch (err) {
			// A committed move can still leave its source file or thumbnail behind.
			// Keep that outcome uncertain and never replay the completed transfer.
			if (err instanceof UnreconciledStorageError) throw err;
			// The item has committed. A notification failure must not cause copying it again.
			logger.warn(
				{ mediaId, err },
				"Media transfer committed; deferred notification failed",
			);
		}
	}
}

/**
 * BulkOperationService - バルク操作機能
 * Feature 15: バルク操作機能
 */

export const BulkOperationService = {
	/**
	 * Performs a bulk edit on multiple media items within a specific source.
	 * @param {string} mediaSourceId - The ID of the media source.
	 * @param {string[]} mediaIds - An array of media IDs to be edited.
	 * @param updates - An object containing the fields to update and their new values.
	 */
	async bulkEditMedia(
		mediaSourceId: string,
		mediaIds: string[],
		updates: UpdateMediaRequestInput,
	) {
		const parsedUpdates = updateMediaRequestSchema.parse(updates);
		const mediaRepo = getBulkMediaRepository();

		// 一括取得してセキュリティ及び整合性チェック
		const mediaList = await mediaRepo.findByIds(mediaIds);
		const mediaMap = new Map(mediaList.map((m) => [m.id, m]));

		for (const mediaId of mediaIds) {
			const media = mediaMap.get(mediaId);
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
		const mediaRepo = getBulkMediaRepository();
		const mediaStorage = services.getMediaStorage();
		const sourceRepo = services.getSourceRepository();

		const source = await sourceRepo.findById(mediaSourceId);
		if (!source) {
			throw new Error(`Media source not found: ${mediaSourceId}`);
		}
		const connectionInfo = source.connectionInfo as Record<
			string,
			unknown
		> | null;
		const basePath = connectionInfo?.path as string | undefined;
		if (!basePath) {
			throw new Error(`Base path not found for media source: ${mediaSourceId}`);
		}

		// 一括取得してセキュリティ及び整合性チェック
		const mediaList = await mediaRepo.findByIds(mediaIds);
		const mediaMap = new Map(mediaList.map((m) => [m.id, m]));

		for (const mediaId of mediaIds) {
			const media = mediaMap.get(mediaId);
			if (!media || media.mediaSourceId !== mediaSourceId) {
				throw new Error(
					`Media with ID ${mediaId} does not belong to source ${mediaSourceId}`,
				);
			}
		}

		for (const media of mediaList) {
			// 実ファイルの削除
			try {
				await mediaStorage.deleteFile(basePath, media.filePath);
			} catch (e) {
				logger.warn(
					{ mediaId: media.id, filePath: media.filePath, error: e },
					"Failed to delete file from storage during bulk delete",
				);
			}
			// サムネイルの削除
			try {
				await deleteThumbnail(mediaSourceId, media.id);
			} catch (e) {
				logger.warn(
					{ mediaId: media.id, error: e },
					"Failed to delete thumbnail during bulk delete",
				);
			}
		}

		if (mediaIds.length > 0) {
			await mediaRepo.bulkDelete(mediaIds);
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
		const mediaRepo = getBulkMediaRepository();
		const mediaStorage = services.getMediaStorage();
		const source = await services.getSourceRepository().findById(mediaSourceId);
		const { localConnectionSchema } =
			await import("@solid-imager/core/sources");
		if (!source || source.type !== "local")
			throw new Error("A local media source is required.");
		const { path: basePath } = localConnectionSchema.parse(
			source.connectionInfo,
		);
		const ids = [...new Set(mediaIds)];
		const { mediaMap, invalid } = await preflight(mediaSourceId, ids);
		if (invalid.size) return rejectedGroup(ids, invalid);
		const items: BulkMediaItemResult[] = [];
		for (const mediaId of ids) {
			const media = mediaMap.get(mediaId);
			if (!media) continue; // preflight already validated every ID
			const newFilePath = `${destinationPath.replace(/\/$/, "")}/${media.fileName}`;
			if (newFilePath === media.filePath) {
				items.push({ mediaId, status: "succeeded" });
				continue;
			}
			try {
				await mediaStorage.moveFile(basePath, media.filePath, newFilePath);
			} catch (err) {
				logger.error({ mediaId, err }, "Bulk folder move failed");
				items.push({
					mediaId,
					status: "failed",
					error: "ファイルの移動に失敗しました。",
				});
				continue;
			}
			try {
				await mediaRepo.bulkUpdatePaths([
					{ id: mediaId, filePath: newFilePath, fileName: media.fileName },
				]);
				items.push({ mediaId, status: "succeeded" });
			} catch (err) {
				logger.error({ mediaId, err }, "Failed to persist bulk folder move");
				let retryable = true;
				try {
					await mediaStorage.moveFile(basePath, newFilePath, media.filePath);
				} catch (rollbackError) {
					retryable = false;
					logger.error(
						{ mediaId, err: rollbackError },
						"Failed to restore file after bulk move persistence failure",
					);
				}
				items.push({
					mediaId,
					status: "failed",
					retryable,
					error:
						"移動結果の保存に失敗しました。一覧とファイルを確認してください。",
				});
			}
		}
		return {
			success: items.every((item) => item.status === "succeeded"),
			items,
		};
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
		const mediaRepo = getBulkMediaRepository();

		// 一括取得してセキュリティ及び整合性チェック
		const mediaList = await mediaRepo.findByIds(mediaIds);
		const mediaMap = new Map(mediaList.map((m) => [m.id, m]));

		for (const mediaId of mediaIds) {
			const media = mediaMap.get(mediaId);
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
		const [{ MediaService }, { executeDeferredActions }] = await Promise.all([
			import("~/infrastructure/services/media-service"),
			import("~/infrastructure/services/job-dispatch-service"),
		]);
		return transferItems(mediaSourceId, mediaIds, (mediaId) =>
			commitTransfer(
				mediaId,
				targetSourceId,
				(id, target, tx) => MediaService.copyMedia(id, target, tx),
				executeDeferredActions,
			),
		);
	},

	/**
	 * Performs a bulk move operation to move multiple media items to a target media source.
	 */
	async bulkMoveToSource(
		mediaSourceId: string,
		mediaIds: string[],
		targetSourceId: string,
	) {
		const [{ MediaService }, { executeDeferredActions }] = await Promise.all([
			import("~/infrastructure/services/media-service"),
			import("~/infrastructure/services/job-dispatch-service"),
		]);
		return transferItems(mediaSourceId, mediaIds, (mediaId) =>
			commitTransfer(
				mediaId,
				targetSourceId,
				(id, target, tx) => MediaService.moveMedia(id, target, tx),
				executeDeferredActions,
			),
		);
	},
};
