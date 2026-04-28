import fs from "node:fs/promises";
import path from "node:path";
import { enqueueThumbnailJobsAfterRestore } from "@solid-imager/application/services/backup-restore-complete";
import { createBackupService } from "@solid-imager/db/backup";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { eq } from "drizzle-orm";
import yauzl from "yauzl";
import { services } from "~/application/registry";
import { db } from "~/infrastructure/db";
import { mediaSources } from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { getDriver } from "~/infrastructure/storage/factory";

function resolvePath(basePath: string, filePath: string) {
	return path.join(basePath, filePath);
}

async function pathExists(fullPath: string) {
	try {
		await fs.access(fullPath);
		return true;
	} catch {
		return false;
	}
}

const backupService = createBackupService({
	getExecutor: (tx?: unknown) => (tx ?? db) as DrizzleExecutor,
	sourceRepository: new DrizzleSourceRepository(),
	resolvePath,
	pathExists,
	runTransaction: async <T>(
		callback: (executor: DrizzleExecutor) => Promise<T>,
	) => {
		return await db.transaction(
			async (tx) => await callback(tx as DrizzleExecutor),
		);
	},
	onRestoreComplete: async ({ source, mediaIds, rootPath }) => {
		try {
			await enqueueThumbnailJobsAfterRestore(
				{ source, mediaIds, rootPath },
				{ jobRepository: services.getJobRepository() },
			);
		} catch (error) {
			logger.warn(
				{ err: error },
				"Failed to queue thumbnail generation jobs after restore (non-critical)",
			);
		}
	},
});

async function loadZipDump(zipFilePath: string) {
	return await new Promise<{
		zipfile: yauzl.ZipFile;
		entries: Map<string, yauzl.Entry>;
		dumpData: unknown;
	}>((resolve, reject) => {
		yauzl.open(
			zipFilePath,
			{ lazyEntries: true, autoClose: false },
			(err, openedZipfile) => {
				if (err || !openedZipfile) {
					reject(err ?? new Error("Failed to open zip"));
					return;
				}

				const entries = new Map<string, yauzl.Entry>();
				let dumpEntry: yauzl.Entry | null = null;

				const rejectAndClose = (error: Error) => {
					openedZipfile.close();
					reject(error);
				};

				openedZipfile.on("error", rejectAndClose);
				openedZipfile.on("entry", (entry) => {
					entries.set(entry.fileName, entry);
					if (entry.fileName === "dump.json") {
						dumpEntry = entry;
					}
					openedZipfile.readEntry();
				});

				openedZipfile.on("end", () => {
					if (!dumpEntry) {
						rejectAndClose(new Error("dump.json not found in ZIP"));
						return;
					}

					openedZipfile.openReadStream(dumpEntry, (readErr, readStream) => {
						if (readErr || !readStream) {
							rejectAndClose(readErr ?? new Error("Failed to read dump.json"));
							return;
						}

						const chunks: Buffer[] = [];
						readStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
						readStream.on("end", () => {
							try {
								const buffer = Buffer.concat(chunks);
								resolve({
									zipfile: openedZipfile,
									entries,
									dumpData: JSON.parse(buffer.toString("utf-8")) as unknown,
								});
							} catch (error) {
								rejectAndClose(error as Error);
							}
						});
						readStream.on("error", rejectAndClose);
					});
				});

				openedZipfile.readEntry();
			},
		);
	});
}

async function createZipDump(
	mediaSourceId: string,
	mode: "json" | "zip" = "json",
) {
	if (mode === "json") {
		return await backupService.createDumpItems(mediaSourceId);
	}

	const source = await db.query.mediaSources.findFirst({
		where: eq(mediaSources.id, mediaSourceId),
	});
	if (!source) {
		throw new Error("Media Source not found");
	}

	const driver = getDriver(source);
	const archiver = (await import("archiver")).default;
	const { PassThrough, Readable } = await import("node:stream");
	const fsSync = await import("node:fs");
	const os = await import("node:os");
	const { randomUUID } = await import("node:crypto");

	const passThrough = new PassThrough();
	const archive = archiver("zip", {
		zlib: { level: 9 },
	});

	let tempJsonPath: string | null = null;
	const cleanup = async () => {
		if (!tempJsonPath) {
			return;
		}
		try {
			await fsSync.promises.unlink(tempJsonPath);
		} catch {
			// ignore
		}
	};

	archive.on("error", async () => {
		await cleanup();
	});
	archive.pipe(passThrough);

	(async () => {
		let jsonStream: import("node:fs").WriteStream | undefined;
		try {
			tempJsonPath = path.join(os.tmpdir(), `dump-${randomUUID()}.json`);
			jsonStream = fsSync.createWriteStream(tempJsonPath);
			jsonStream.write("[\n");

			let isFirst = true;
			for await (const item of backupService.iterateDumpItems(mediaSourceId)) {
				if (!isFirst) {
					jsonStream.write(",\n");
				}
				jsonStream.write(JSON.stringify(item, null, 2));
				isFirst = false;

				if (!item.filePath) {
					continue;
				}

				try {
					backupService.validateRelativePath(item.filePath);
				} catch {
					continue;
				}

				try {
					const buffer = await driver.get(item.filePath);
					archive.append(buffer, { name: `images/${item.filePath}` });
				} catch {
					// ignore missing files
				}
			}

			jsonStream.write("\n]");
			await new Promise<void>((resolve, reject) => {
				jsonStream?.end(() => resolve());
				jsonStream?.on("error", reject);
			});

			archive.append(fsSync.createReadStream(tempJsonPath), {
				name: "dump.json",
			});
		} catch (error) {
			logger.error({ err: error }, "Failed to create dump");
			archive.abort();
			jsonStream?.destroy();
		} finally {
			await archive.finalize();
			passThrough.on("close", cleanup);
			passThrough.on("end", cleanup);
		}
	})();

	return Readable.toWeb(passThrough) as unknown as ReadableStream;
}

export const BackupService = {
	...backupService,
	_filterValidItems: backupService.filterValidItems,
	_restoreMasterData: backupService.restoreMasterData,
	_restoreMediaRecords: backupService.restoreMediaRecords,
	_mapMediaPathsToIds: backupService.mapMediaPathsToIds,
	_restoreRelations(params: {
		validItems: unknown[];
		mediaPathToId: Map<string, string>;
		tagMap: Map<string, string>;
		authorMap: Map<string, string>;
		projectMap: Map<string, string>;
		ipMap: Map<string, string>;
		charMap: Map<string, string>;
	}) {
		return backupService.restoreRelations(db, {
			items: params.validItems as never[],
			mediaPathToId: params.mediaPathToId,
			tagMap: params.tagMap,
			authorMap: params.authorMap,
			projectMap: params.projectMap,
			ipMap: params.ipMap,
			charMap: params.charMap,
		});
	},
	_transformMediaList(mediaList: unknown[]) {
		return backupService.transformMediaList(mediaList as never[]);
	},

	async createDump(mediaSourceId: string, mode: "json" | "zip" = "json") {
		return await createZipDump(mediaSourceId, mode);
	},

	async importSourceZip(mediaSourceId: string, zipFilePath: string) {
		const source = await db.query.mediaSources.findFirst({
			where: eq(mediaSources.id, mediaSourceId),
		});

		if (!source) {
			throw new Error("Media source not found");
		}

		const { zipfile, entries, dumpData } = await loadZipDump(zipFilePath);
		try {
			if (!Array.isArray(dumpData)) {
				throw new Error("Invalid dump format");
			}

			const driver = getDriver(source);
			for (const item of dumpData) {
				if (!item || typeof item !== "object" || !("filePath" in item)) {
					continue;
				}
				const filePath = (item as { filePath?: string }).filePath;
				if (!filePath) {
					continue;
				}
				try {
					backupService.validateRelativePath(filePath);
				} catch {
					continue;
				}

				const imagePathInZip = `images/${filePath}`;
				const entry = entries.get(imagePathInZip);
				if (!entry) {
					continue;
				}

				await new Promise<void>((resolve, reject) => {
					zipfile.openReadStream(entry, (err, readStream) => {
						if (err || !readStream) {
							reject(
								err ?? new Error(`Failed to read stream for ${entry.fileName}`),
							);
							return;
						}

						const chunks: Buffer[] = [];
						readStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
						readStream.on("end", async () => {
							try {
								await driver.put(filePath, Buffer.concat(chunks));
								resolve();
							} catch (error) {
								reject(error);
							}
						});
						readStream.on("error", reject);
					});
				});
			}
		} finally {
			zipfile.close();
		}

		const restoreResult = await backupService.restoreSource(
			mediaSourceId,
			dumpData as unknown[],
		);

		return {
			success: true,
			importedCount: restoreResult.processed,
			skippedCount: restoreResult.skipped,
			errors: restoreResult.errors,
			message: `Successfully imported ${restoreResult.processed} items (Skipped: ${restoreResult.skipped})`,
		};
	},
};
