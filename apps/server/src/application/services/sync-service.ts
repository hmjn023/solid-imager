import type {
	SyncDiff,
	SyncManifest,
	SyncManifestItem,
} from "@solid-imager/core/domain/media/schemas";
import { eq } from "drizzle-orm";
import { services } from "~/application/registry";
import { BackupService } from "~/application/services/backup-service";
import { db } from "~/infrastructure/db";
import { mediaSources } from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";
import { getDriver } from "~/infrastructure/storage/factory";

/**
 * Service for multi-server media synchronization.
 */
export const SyncService = {
	/**
	 * Generates a sync manifest for a specific media source.
	 */
	async generateManifest(sourceId: string): Promise<SyncManifest> {
		const mediaRepo = services.getMediaRepository();
		const items = await mediaRepo.getSyncManifestData(sourceId);

		return {
			sourceId,
			items: items.map((item) => ({
				filePath: item.filePath,
				hashMd5: item.hashMd5,
				fileSize: item.fileSize,
				modifiedAt: item.modifiedAt,
			})),
		};
	},

	/**
	 * Compares a local manifest with a remote manifest to determine differences.
	 * Implements "last-write-wins" resolution logic using modifiedAt.
	 */
	compareManifests(local: SyncManifest, remote: SyncManifest): SyncDiff {
		const localMap = new Map<string, SyncManifestItem>(
			local.items.map((item) => [item.filePath, item]),
		);
		const remoteMap = new Map<string, SyncManifestItem>(
			remote.items.map((item) => [item.filePath, item]),
		);

		const missingLocally: SyncManifestItem[] = [];
		const missingRemotely: SyncManifestItem[] = [];
		const updateLocally: SyncManifestItem[] = [];
		const updateRemotely: SyncManifestItem[] = [];
		const conflicts: { local: SyncManifestItem; remote: SyncManifestItem }[] =
			[];

		// Check remote items
		for (const remoteItem of remote.items) {
			const localItem = localMap.get(remoteItem.filePath);

			if (!localItem) {
				missingLocally.push(remoteItem);
			} else if (localItem.hashMd5 !== remoteItem.hashMd5) {
				// Hash mismatch - decide who is newer
				const localTime = new Date(localItem.modifiedAt).getTime();
				const remoteTime = new Date(remoteItem.modifiedAt).getTime();

				if (remoteTime > localTime) {
					updateLocally.push(remoteItem);
				} else if (localTime > remoteTime) {
					updateRemotely.push(localItem);
				} else {
					// Same timestamp, different hash? Conflict.
					conflicts.push({ local: localItem, remote: remoteItem });
				}
			}
		}

		// Check local items for missing remotely
		for (const localItem of local.items) {
			if (!remoteMap.has(localItem.filePath)) {
				missingRemotely.push(localItem);
			}
		}

		return {
			remoteSourceId: remote.sourceId,
			missingLocally,
			missingRemotely,
			updateLocally,
			updateRemotely,
			conflicts,
		};
	},

	/**
	 * Prepares a sync ZIP package containing specified files and their metadata.
	 */
	async prepareSyncPackage(sourceId: string, filePaths: string[]) {
		const mediaSource = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, sourceId),
		});

		if (!mediaSource) {
			throw new Error("Media Source not found");
		}

		const archiver = (await import("archiver")).default;
		const { PassThrough, Readable } = await import("node:stream");
		const driver = getDriver(mediaSource);

		const passThrough = new PassThrough();
		const archive = archiver("zip", { zlib: { level: 9 } });
		archive.pipe(passThrough);

		// Get metadata for these specific files
		const mediaRepo = services.getMediaRepository();
		const mediaList = await Promise.all(
			filePaths.map(async (p) => {
				const media = await mediaRepo.findByPath(sourceId, p);
				if (!media) return null;
				return await mediaRepo.getDetails(media.id);
			}),
		);

		const validMediaList = mediaList.filter(
			(m): m is NonNullable<typeof m> => m !== null,
		);
		const dumpData = (BackupService as any)._transformMediaList(validMediaList);

		archive.append(JSON.stringify(dumpData, null, 2), { name: "dump.json" });

		for (const filePath of filePaths) {
			try {
				const buffer = await driver.get(filePath);
				archive.append(buffer, { name: `images/${filePath}` });
			} catch (e) {
				logger.warn({ err: e, filePath }, "Failed to add file to sync package");
			}
		}

		await archive.finalize();

		return Readable.toWeb(passThrough) as unknown as ReadableStream;
	},

	/**
	 * Processes a sync package (ZIP stream).
	 */
	async processSyncPackage(targetSourceId: string, zipStream: ReadableStream) {
		const { randomUUID } = await import("node:crypto");
		const path = await import("node:path");
		const nodeOs = await import("node:os");
		const fs = await import("node:fs");
		const { pipeline } = await import("node:stream/promises");
		const { Readable } = await import("node:stream");

		const tempFilePath = path.join(
			nodeOs.tmpdir(),
			`sync-import-${randomUUID()}.zip`,
		);

		try {
			await pipeline(
				Readable.fromWeb(zipStream as any),
				fs.createWriteStream(tempFilePath),
			);

			return await BackupService.importSourceZip(targetSourceId, tempFilePath);
		} finally {
			try {
				await fs.promises.unlink(tempFilePath);
			} catch {
				// ignore
			}
		}
	},
};
