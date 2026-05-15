import {
	type MediaSource,
	mediaSources,
	medias,
	type NewMedia,
} from "@solid-imager/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { NotFoundError, UnknownDbError } from "./errors";

/**
 * Represents the data structure for importing media source data, including media items.
 * @property {MediaSource} mediaSource - The media source object to import.
 * @property {NewMedia[]} medias - An array of new media items associated with the source.
 * @property {any} [otherTables] - Placeholder for other tables that might be included in the import.
 */
type ImportData = {
	mediaSource: MediaSource;
	medias: NewMedia[];
	// Add other tables as needed
};
/**
 * Selects all data related to a specific media source, including its associated media, tags, details, etc.
 * @param {string} mediaSourceId - The ID of the media source to select data for.
 * @returns {Promise<any>} A promise that resolves with the comprehensive media source data.
 * @throws {NotFoundError} If the media source data for the given ID is not found.
 * @throws {UnknownDbError} If a database error occurs during the selection process.
 */
export const selectMediaSourceData = async (mediaSourceId: string) => {
	try {
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
			with: {
				media: {
					with: {
						tags: { with: { tag: true } },
						details: true,
						generationInfo: true,
						categories: { with: { category: true } },
						projects: { with: { project: true } },
						ips: { with: { ip: true } },
						technicalInfo: true,
						sync: true,
						characters: { with: { character: true } },
					},
				},
			},
		});

		if (!mediaSource) {
			throw new NotFoundError({
				message: `Media source data for ID ${mediaSourceId} not found`,
			});
		}

		return mediaSource;
	} catch (error) {
		if (error instanceof NotFoundError) {
			throw error;
		}
		throw new UnknownDbError({
			message: `Failed to select media source data for source ID: ${mediaSourceId}`,
			details: error,
		});
	}
};

/**
 * Inserts or updates media source data, including the media source itself and its associated media items.
 * @param {string} _mediaSourceId - The ID of the media source to upsert data for.
 * @param {ImportData} importData - The data to upsert.
 * @returns {Promise<void>} A promise that resolves when the upsert operation is complete.
 * @throws {UnknownDbError} If a database error occurs during the upsert process.
 */
export const upsertMediaSourceData = async (
	_mediaSourceId: string,
	importData: ImportData,
) => {
	try {
		return await db.transaction(async (tx) => {
			// Upsert mediaSource
			await tx
				.insert(mediaSources)
				.values(importData.mediaSource)
				.onConflictDoUpdate({
					target: mediaSources.id,
					set: importData.mediaSource,
				});

			// Upsert medias
			if (importData.medias && importData.medias.length > 0) {
				await tx.insert(medias).values(importData.medias).onConflictDoNothing();
				// Note: This is a simplification. A real implementation would need to handle updates.
			}

			// ... other tables would be handled here
		});
	} catch (error) {
		throw new UnknownDbError({
			message: `Failed to upsert media source data for source ID: ${_mediaSourceId}`,
			details: error,
		});
	}
};

/**
 * Reconciles the media source data in the database with changes detected in the file system.
 * Handles adding new files and deleting removed files.
 * @param {string} mediaSourceId - The ID of the media source to reconcile.
 * @param {object} fileSystemChanges - An object containing added and deleted file information.
 * @param {NewMedia[]} fileSystemChanges.added - An array of new media items to add.
 * @param {string[]} fileSystemChanges.deleted - An array of file paths for media items to delete.
 * @returns {Promise<void>} A promise that resolves when the reconciliation is complete.
 * @throws {UnknownDbError} If a database error occurs during the reconciliation process.
 */
export const reconcileMediaSource = async (
	mediaSourceId: string,
	fileSystemChanges: { added: NewMedia[]; deleted: string[] },
) => {
	try {
		return await db.transaction(async (tx) => {
			// Handle added files
			if (fileSystemChanges.added && fileSystemChanges.added.length > 0) {
				await tx
					.insert(medias)
					.values(fileSystemChanges.added)
					.onConflictDoNothing();
			}

			// Handle deleted files
			if (fileSystemChanges.deleted && fileSystemChanges.deleted.length > 0) {
				await tx
					.delete(medias)
					.where(
						and(
							eq(medias.mediaSourceId, mediaSourceId),
							inArray(medias.filePath, fileSystemChanges.deleted),
						),
					);
			}
		});
	} catch (error) {
		throw new UnknownDbError({
			message: `Failed to reconcile media source for source ID: ${mediaSourceId}`,
			details: error,
		});
	}
};

/**
 * Clones media data from an original source to a new source.
 * @param {string} originalSourceId - The ID of the original media source.
 * @param {string} newSourceId - The ID of the new media source.
 * @returns {Promise<void>} A promise that resolves when the media data has been cloned.
 * @throws {UnknownDbError} If a database error occurs during the cloning process.
 */
export const cloneMediaData = async (
	originalSourceId: string,
	newSourceId: string,
) => {
	try {
		return await db.transaction(async (tx) => {
			const allMedia = await tx
				.select()
				.from(medias)
				.where(eq(medias.mediaSourceId, originalSourceId));

			if (allMedia.length > 0) {
				const newMedias: NewMedia[] = allMedia.map((media) => {
					const { id: _id, mediaSourceId: _mediaSourceId, ...rest } = media;
					return { ...rest, mediaSourceId: newSourceId };
				});
				await tx.insert(medias).values(newMedias);
			}
		});
	} catch (error) {
		throw new UnknownDbError({
			message: `Failed to clone media data from source ID: ${originalSourceId} to ${newSourceId}`,
			details: error,
		});
	}
};
