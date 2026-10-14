import { createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { cleanupSourceRunFiles } from "./source-run-retention";
import { and, asc, eq, gt } from "drizzle-orm";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	SourceRunAttemptLostError,
	type SourceRunClaim,
	type SourceRunCheckpoint,
	type SourceRun,
} from "@solid-imager/core/domain/source-runs/schemas";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { getSourceRunRevision } from "@solid-imager/core/domain/sources/run-revision";
import { getExecutor } from "~/infrastructure/db/executor";
import { medias, mediaSources } from "~/infrastructure/db/schema";
import { SourceRunRepository as repo } from "~/infrastructure/repositories/source-run-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { deleteThumbnail } from "~/infrastructure/jobs/thumbnails";
import { services } from "~/infrastructure/service-registry";
import { logger } from "~/infrastructure/logger";
import { MediaProcessingService } from "./media-processing-service";
import { ccipVectorService } from "./ccip-vector-service";
import { BackupService } from "./backup-service";
import {
	getArtifactMetadata,
	getJobTransferRoot,
	getInputPath,
	isJobTransferPath,
	removeJobTransferFile,
} from "./job-transfer-storage";
import {
	asDumpStream,
	webReadableToNodeStream,
} from "~/infrastructure/utils/stream-utils";
import {
	extractSourceTar,
	fingerprintSourceInput,
	sourceInputLines,
	stageSourceImage,
	validateSourceRelativePath,
} from "./source-run-files";

class SourceChangedError extends Error {}

async function currentSource(claim: SourceRunClaim, tx: Transaction) {
	const [source] = await getExecutor(tx)
		.select()
		.from(mediaSources)
		.where(eq(mediaSources.id, claim.sourceId))
		.for("share");
	if (!source) throw new SourceChangedError("Source removed");
	if (claim.input.kind === "sync") {
		if (
			source.type !== "local" ||
			path.resolve(localConnectionSchema.parse(source.connectionInfo).path) !==
				path.resolve(claim.input.sourcePath)
		)
			throw new SourceChangedError("Source configuration changed");
	} else if (
		getSourceRunRevision(source.type, source.connectionInfo) !==
		claim.input.sourceRevision
	)
		throw new SourceChangedError("Source configuration changed");
	return source;
}

function notify(run: SourceRun) {
	try {
		if (run.status === "completed")
			RealtimeEventBus.publishJob("job-completed", {
				jobId: run.id,
				message: "Source operation completed",
			});
		else if (run.status === "failed" || run.status === "blocked")
			RealtimeEventBus.publishJob("job-failed", {
				jobId: run.id,
				error: "Source operation failed",
			});
		if (run.kind === "sync" && run.sourceId)
			RealtimeEventBus.publishSource(run.sourceId, "source-sync-status", {
				mediaSourceId: run.sourceId,
				status: ["completed", "cancelled"].includes(run.status)
					? "idle"
					: ["failed", "blocked"].includes(run.status)
						? "error"
						: "syncing",
				timestamp: new Date().toISOString(),
			});
	} catch (err) {
		logger.warn({ err, runId: run.id }, "Source notification failed");
	}
}

async function* scanFiles(root: string, relative = ""): AsyncGenerator<string> {
	const directory = await fs.opendir(path.join(root, relative));
	for await (const entry of directory) {
		if (entry.name.startsWith(".")) continue;
		const file = path.posix.join(relative, entry.name);
		if (entry.isDirectory()) yield* scanFiles(root, file);
		else if (entry.isFile()) yield file;
	}
}

async function sync(claim: SourceRunClaim, signal: AbortSignal) {
	if (claim.input.kind !== "sync") throw new Error("Invalid sync claim");
	const root = claim.input.sourcePath;
	const supported = new Set(
		Object.values(
			services.getConfigService().getConfig().media.supportedExtensions,
		)
			.flat()
			.map((ext) => ext.toLowerCase()),
	);
	let checkpoint = { ...claim.checkpoint };
	// A failed traversal never enters deletion. Retry rescans additions idempotently.
	for await (const file of scanFiles(root)) {
		signal.throwIfAborted();
		if (!supported.has(path.extname(file).toLowerCase())) continue;
		await repo.withActiveClaim(claim, async (tx) => {
			await currentSource(claim, tx);
			if (!(await MediaRepository.findByPath(claim.sourceId, file, tx))) {
				await MediaProcessingService.registerAndProcess(
					claim.sourceId,
					file,
					undefined,
					{ tx, sourcePath: root },
				);
				checkpoint = { ...checkpoint, added: checkpoint.added + 1 };
				await repo.checkpoint(claim, checkpoint, tx);
			}
		});
	}
	let after: string | undefined;
	for (;;) {
		signal.throwIfAborted();
		const rows = await getExecutor()
			.select({ id: medias.id, filePath: medias.filePath })
			.from(medias)
			.where(
				and(
					eq(medias.mediaSourceId, claim.sourceId),
					after ? gt(medias.id, after) : undefined,
				),
			)
			.orderBy(asc(medias.id))
			.limit(100);
		if (!rows.length) break;
		for (const row of rows) {
			validateSourceRelativePath(row.filePath);
			try {
				await fs.access(path.join(root, row.filePath));
				continue;
			} catch (error) {
				if (
					!(
						error &&
						typeof error === "object" &&
						"code" in error &&
						error.code === "ENOENT"
					)
				)
					throw error;
			}
			const deleted = await repo.withActiveClaim(claim, async (tx) => {
				await currentSource(claim, tx);
				const [current] = await getExecutor(tx)
					.select()
					.from(medias)
					.where(eq(medias.id, row.id))
					.for("update");
				if (
					!current ||
					current.mediaSourceId !== claim.sourceId ||
					current.filePath !== row.filePath
				)
					return false;
				try {
					await fs.access(path.join(root, row.filePath));
					return false;
				} catch (error) {
					if (
						!(
							error &&
							typeof error === "object" &&
							"code" in error &&
							error.code === "ENOENT"
						)
					)
						throw error;
				}
				await MediaRepository.delete(row.id, tx);
				checkpoint = { ...checkpoint, deleted: checkpoint.deleted + 1 };
				await repo.checkpoint(claim, checkpoint, tx);
				return true;
			});
			if (deleted) {
				await ccipVectorService
					.delete(row.id)
					.catch((err) =>
						logger.warn(
							{ err, mediaId: row.id },
							"Source vector cleanup failed",
						),
					);
				await deleteThumbnail(claim.sourceId, row.id);
				RealtimeEventBus.publishSource(claim.sourceId, "media-deleted", {
					mediaId: row.id,
					filePath: row.filePath,
					timestamp: new Date().toISOString(),
				});
			}
		}
		after = rows.at(-1)?.id;
	}
	return repo.complete(claim, undefined, async (tx) => {
		await currentSource(claim, tx);
	});
}

async function exportSource(claim: SourceRunClaim, signal: AbortSignal) {
	if (claim.input.kind !== "export") throw new Error("Invalid export claim");
	await repo.withActiveClaim(claim, (tx) => currentSource(claim, tx));
	const artifact = getArtifactMetadata(
		claim.id,
		claim.sourceId,
		claim.input.mode,
	);
	artifact.path = path.join(
		path.dirname(artifact.path),
		claim.id + "." + claim.leaseToken + "." + claim.input.mode,
	);
	const partial = artifact.path + ".partial";
	let completed = false;
	try {
		await fs.mkdir(path.dirname(partial), { recursive: true });
		const dump = await BackupService.createDump(
			claim.sourceId,
			claim.input.mode,
			{ includeImages: claim.input.includeImages, jobId: claim.id, signal },
		);
		await pipeline(
			webReadableToNodeStream(asDumpStream(dump)),
			createWriteStream(partial, { flags: "wx" }),
			{ signal },
		);
		const stat = await fs.stat(partial);
		const result = await repo.complete(
			claim,
			{ ...artifact, size: stat.size },
			async (tx) => {
				await currentSource(claim, tx);
				signal.throwIfAborted();
				await fs.rename(partial, artifact.path);
			},
		);
		completed = result !== null;
		return result;
	} finally {
		await removeJobTransferFile(partial);
		if (!completed) await removeJobTransferFile(artifact.path);
	}
}

async function restoreNdjson(
	claim: SourceRunClaim,
	input: string,
	signal: AbortSignal,
	checkpoint: SourceRunCheckpoint,
) {
	let batch: unknown[] = [],
		bytes = 0,
		offset = checkpoint.offset,
		invalid = 0;
	const flush = async () => {
		if (offset === checkpoint.offset) return;
		await repo.withActiveClaim(claim, async (tx) => {
			await currentSource(claim, tx);
			const result = await BackupService.restoreSource(
				claim.sourceId,
				batch,
				tx,
			);
			checkpoint = {
				...checkpoint,
				offset,
				processed: checkpoint.processed + result.processed,
				skipped: checkpoint.skipped + result.skipped + invalid,
			};
			await repo.checkpoint(claim, checkpoint, tx);
		});
		batch = [];
		bytes = 0;
		invalid = 0;
	};
	for await (const line of sourceInputLines(input, checkpoint.offset, signal)) {
		offset = line.offset;
		bytes += Buffer.byteLength(line.text);
		try {
			if (line.text.trim()) batch.push(JSON.parse(line.text));
		} catch {
			invalid++;
		}
		if (batch.length >= 100 || bytes >= 4 * 1024 * 1024) await flush();
	}
	await flush();
	return checkpoint;
}

async function restoreSource(claim: SourceRunClaim, signal: AbortSignal) {
	if (
		claim.input.kind !== "restore" ||
		!isJobTransferPath(claim.id, claim.input.inputPath)
	)
		throw new Error("Invalid restore input");
	const identity = await fingerprintSourceInput(claim.input.inputPath, signal);
	if (
		identity.inputDigest !== claim.input.inputDigest ||
		identity.inputSize !== claim.input.inputSize
	)
		throw new SourceChangedError("Restore input changed");
	let checkpoint = { ...claim.checkpoint };
	const source = await repo.withActiveClaim(claim, (tx) =>
		currentSource(claim, tx),
	);
	const staging = path.join(
		getJobTransferRoot(),
		"staging",
		claim.id + "." + claim.leaseToken,
	);
	try {
		let dump = claim.input.inputPath;
		if (claim.input.mode === "tar") {
			if (source.type !== "local")
				throw new Error("Image restore requires a local source");
			const archive = await extractSourceTar(
				claim.input.inputPath,
				staging,
				signal,
			);
			dump = archive.dump;
			let index = 0;
			const root = localConnectionSchema.parse(source.connectionInfo).path;
			if (!checkpoint.filesComplete)
				for await (const entry of sourceInputLines(
					archive.manifest,
					0,
					signal,
				)) {
					index++;
					if (index <= Number(checkpoint.fileCursor ?? 0)) continue;
					const relative = validateSourceRelativePath(entry.text).slice(
						"images/".length,
					);
					const image = await stageSourceImage(
						root,
						relative,
						path.join(staging, entry.text),
						claim.leaseToken,
						signal,
					);
					try {
						await repo.withActiveClaim(claim, async (tx) => {
							await currentSource(claim, tx);
							signal.throwIfAborted();
							await fs.rename(image.partial, image.target);
							checkpoint = { ...checkpoint, fileCursor: String(index) };
							await repo.checkpoint(claim, checkpoint, tx);
						});
					} finally {
						await fs.rm(image.partial, { force: true });
					}
				}
			checkpoint = { ...checkpoint, filesComplete: true };
			await repo.withActiveClaim(claim, async (tx) => {
				await currentSource(claim, tx);
				await repo.checkpoint(claim, checkpoint, tx);
			});
		}
		await restoreNdjson(claim, dump, signal, checkpoint);
		return repo.complete(claim, undefined, async (tx) => {
			await currentSource(claim, tx);
		});
	} finally {
		await fs.rm(staging, { recursive: true, force: true });
	}
}

export const sourceRunService = {
	initialize: () => repo.initialize(),
	notify,
	async process(claim: SourceRunClaim, signal: AbortSignal) {
		try {
			if (claim.kind === "sync") notify(claim);
			const run = await (claim.kind === "sync"
				? sync(claim, signal)
				: claim.kind === "export"
					? exportSource(claim, signal)
					: restoreSource(claim, signal));
			if (run) notify(run);
		} catch (err) {
			if (err instanceof SourceRunAttemptLostError || signal.aborted) return;
			logger.error({ err, runId: claim.id }, "Source operation failed");
			const run = await repo.fail(
				claim,
				err instanceof SourceChangedError ? "source_changed" : "source_failed",
				err instanceof SourceChangedError,
			);
			if (run) notify(run);
		}
	},
	async syncMediaSource(sourceId: string) {
		await repo.initialize();
		const source = await services.getSourceRepository().findById(sourceId);
		if (!source || source.type !== "local")
			return { sourceId, added: 0, deleted: 0 };
		const queued = await repo.requestSync(
			sourceId,
			localConnectionSchema.parse(source.connectionInfo).path,
		);
		notify(queued.run);
		for (;;) {
			const run = await repo.findById(queued.run.id);
			if (!run) throw new Error("Source operation disappeared");
			if (run.status === "completed")
				return {
					sourceId,
					added: run.checkpoint.added,
					deleted: run.checkpoint.deleted,
				};
			if (!["pending", "in_progress"].includes(run.status))
				throw new Error("Directory sync failed");
			await delay(250);
		}
	},
	/** Bulk metadata restore uses the same durable ownership/cursor as uploaded backups. */
	async restoreItems(sourceId: string, items: unknown[]) {
		await repo.initialize();
		const source = await services.getSourceRepository().findById(sourceId);
		if (!source) throw new SourceChangedError("Source removed");
		const id = randomUUID(),
			inputPath = getInputPath(id, "ndjson"),
			partial = inputPath + ".partial";
		let queued = false;
		try {
			await fs.mkdir(path.dirname(inputPath), { recursive: true });
			await pipeline(
				Readable.from(
					(async function* () {
						for (const item of items) yield JSON.stringify(item) + "\n";
					})(),
				),
				createWriteStream(partial, { flags: "wx" }),
			);
			await fs.rename(partial, inputPath);
			const run = await repo.createTransfer(
				sourceId,
				{
					kind: "restore",
					mode: "ndjson",
					inputPath,
					...(await fingerprintSourceInput(inputPath)),
					sourceRevision: getSourceRunRevision(
						source.type,
						source.connectionInfo,
					),
				},
				id,
			);
			queued = true;
			for (;;) {
				const current = await repo.findById(run.id);
				if (!current) throw new Error("Restore operation disappeared");
				if (current.status === "completed")
					return {
						processed: current.checkpoint.processed,
						skipped: current.checkpoint.skipped,
					};
				if (!["pending", "in_progress"].includes(current.status))
					return {
						processed: current.checkpoint.processed,
						skipped: Math.max(0, items.length - current.checkpoint.processed),
					};
				await delay(250);
			}
		} finally {
			await fs.rm(partial, { force: true });
			if (!queued) await fs.rm(inputPath, { force: true });
		}
	},
	cleanup: cleanupSourceRunFiles,
};
