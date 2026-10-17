import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import {
	mediaSources,
	medias,
	sourceSyncRuns,
	sourceSyncWatermarks,
	sourceTransferRuns,
	sourceRunLeases,
} from "~/infrastructure/db/schema";
import { SourceRunRepository as repo } from "~/infrastructure/repositories/source-run-repository";
import { services } from "~/infrastructure/service-registry";
import { sourceRunService } from "~/infrastructure/services/source-run-service";
import {
	getInputPath,
	getJobTransferRoot,
} from "~/infrastructure/services/job-transfer-storage";
import { fingerprintSourceInput } from "~/infrastructure/services/source-run-files";
import { getSourceRunRevision } from "@solid-imager/core/domain/sources/run-revision";
import {
	toSafeSourceRun,
	toSourceJobDto,
} from "~/infrastructure/api/source-run-view";
import { resolveJobArtifact } from "~/infrastructure/api/job-artifact";
import { BackupService } from "~/infrastructure/services/backup-service";
import { asDumpStream } from "~/infrastructure/utils/stream-utils";
import type { SourceRunKind } from "@solid-imager/core/domain/source-runs/schemas";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";

const png = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);
vi.hoisted(() => {
	process.env.SOLID_IMAGER_JOB_TRANSFER_DIR = `/tmp/solid-source-transfers-${process.pid}`;
});
describe("source workflow filesystem and DB recovery", () => {
	let directory: string, sourceId: string, revision: string;
	const owned: string[] = [];
	afterAll(async () => {
		await fs.rm(getJobTransferRoot(), { recursive: true, force: true });
	});
	const claimed = async (kind: SourceRunKind) => {
		const [run] = await repo.claimPending([kind], 1, sourceId);
		if (!run) throw new Error("No source claim");
		return run;
	};
	const execute = async (kind: SourceRunKind) => {
		const claim = await claimed(kind);
		await sourceRunService.process(claim, new AbortController().signal);
		return (await repo.findById(claim.id))!;
	};
	const createInput = async (
		content: string,
		mode: "ndjson" | "tar" = "ndjson",
	) => {
		const id = randomUUID(),
			inputPath = getInputPath(id, mode);
		owned.push(inputPath);
		await fs.mkdir(path.dirname(inputPath), { recursive: true });
		await fs.writeFile(inputPath, content);
		return { id, inputPath };
	};
	beforeEach(async () => {
		await services.getJobWorker().stop();
		await services.getMediaAiWorker().stop();
		await services.getMediaFileWorker().stop();
		directory = await fs.mkdtemp(
			path.join(os.tmpdir(), "solid-source-operations-"),
		);
		const source = await services.getSourceRepository().create({
			name: randomUUID(),
			description: null,
			type: "local",
			connectionInfo: { path: directory },
		});
		sourceId = source.id;
		revision = getSourceRunRevision(source.type, source.connectionInfo);
	});
	afterEach(async () => {
		vi.restoreAllMocks();
		for (const file of owned.splice(0)) await fs.rm(file, { force: true });
		if (sourceId) {
			const runs = await repo.list({ sourceId, limit: 100, offset: 0 });
			for (const run of runs.items) {
				if (run.artifact) await fs.rm(run.artifact.path, { force: true });
				await db
					.delete(sourceRunLeases)
					.where(eq(sourceRunLeases.sourceId, sourceId));
			}
			await db
				.delete(sourceSyncRuns)
				.where(eq(sourceSyncRuns.sourceId, sourceId));
			await db
				.delete(sourceTransferRuns)
				.where(eq(sourceTransferRuns.sourceId, sourceId));
			await db.delete(mediaSources).where(eq(mediaSources.id, sourceId));
			await db
				.delete(sourceSyncWatermarks)
				.where(eq(sourceSyncWatermarks.sourceId, sourceId));
		}
		if (directory) await fs.rm(directory, { recursive: true, force: true });
	});

	it("does not renew a source lease for every unchanged file", async () => {
		const files = Array.from(
			{ length: 201 },
			(_, index) => `existing-${index}.png`,
		);
		for (let offset = 0; offset < files.length; offset += 25)
			await Promise.all(
				files
					.slice(offset, offset + 25)
					.map((file) => fs.writeFile(path.join(directory, file), png)),
			);
		await db.insert(medias).values(
			files.map((file) => ({
				mediaSourceId: sourceId,
				filePath: file,
				fileName: file,
				mediaType: "image" as const,
				width: 1,
				height: 1,
				fileSize: png.length,
			})),
		);
		const renew = vi.spyOn(repo, "withActiveClaim");
		await repo.requestSync(sourceId, directory);
		const run = await execute("sync");
		expect(run.status).toBe("completed");
		expect(run.checkpoint).toMatchObject({ added: 0, deleted: 0 });
		expect(renew.mock.calls.length).toBeLessThanOrEqual(10);
	}, 20_000);

	it("scans additions and deletions without loading the source path set", async () => {
		const publish = vi.spyOn(RealtimeEventBus, "publishSource");
		await fs.mkdir(path.join(directory, "nested"));
		await fs.writeFile(path.join(directory, "nested", "one.png"), png);
		await services.getMediaRepository().create({
			mediaSourceId: sourceId,
			filePath: "gone.png",
			fileName: "gone.png",
			mediaType: "image",
			width: 1,
			height: 1,
			fileSize: png.length,
			description: null,
			createdAt: new Date(),
			modifiedAt: new Date(),
		});
		await repo.requestSync(sourceId, directory);
		const run = await execute("sync");
		expect(run.status).toBe("completed");
		expect(run.checkpoint).toMatchObject({ added: 1, deleted: 1 });
		expect(
			(
				await services
					.getMediaRepository()
					.findByPath(sourceId, "nested/one.png")
			)?.filePath,
		).toBe("nested/one.png");
		expect(
			await services.getMediaRepository().findByPath(sourceId, "gone.png"),
		).toBeNull();
		expect(
			(await services.getSourceRepository().findById(sourceId))?.syncStatus,
		).toBe("idle");
		const media = await services
			.getMediaRepository()
			.findByPath(sourceId, "nested/one.png");
		expect(publish).toHaveBeenCalledWith(sourceId, "media-added", {
			mediaId: media?.id,
			filePath: "nested/one.png",
		});
		expect(
			publish.mock.calls.filter((call) => call[1] === "media-added"),
		).toHaveLength(1);
	});
	it("does not announce a source addition whose registration transaction rolls back", async () => {
		await fs.writeFile(path.join(directory, "one.png"), png);
		const publish = vi.spyOn(RealtimeEventBus, "publishSource");
		const withActiveClaim = repo.withActiveClaim;
		vi.spyOn(repo, "withActiveClaim").mockImplementationOnce((claim, action) =>
			withActiveClaim(claim, async (tx, current) => {
				await action(tx, current);
				throw new Error("commit unavailable");
			}),
		);
		await repo.requestSync(sourceId, directory);
		expect((await execute("sync")).status).toBe("failed");
		expect(
			await services.getMediaRepository().findByPath(sourceId, "one.png"),
		).toBeNull();
		expect(
			publish.mock.calls.filter((call) => call[1] === "media-added"),
		).toEqual([]);
	});
	it("keeps committed source additions when a notification listener fails", async () => {
		await fs.writeFile(path.join(directory, "one.png"), png);
		const publish = vi
			.spyOn(RealtimeEventBus, "publishSource")
			.mockImplementation((_sourceId, event) => {
				if (event === "media-added") throw new Error("listener failed");
			});
		await repo.requestSync(sourceId, directory);
		expect(await execute("sync")).toMatchObject({
			status: "completed",
			checkpoint: { added: 1 },
		});
		expect(
			await services.getMediaRepository().findByPath(sourceId, "one.png"),
		).not.toBeNull();
		expect(
			publish.mock.calls.filter((call) => call[1] === "media-added"),
		).toHaveLength(1);
	});

	it("keeps existing media when the source traversal fails and exposes the failure after restart", async () => {
		await services.getMediaRepository().create({
			mediaSourceId: sourceId,
			filePath: "keep.png",
			fileName: "keep.png",
			mediaType: "image",
			width: 1,
			height: 1,
			fileSize: 1,
			description: null,
			createdAt: new Date(),
			modifiedAt: new Date(),
		});
		await fs.rm(directory, { recursive: true });
		await repo.requestSync(sourceId, directory);
		expect((await execute("sync")).status).toBe("failed");
		expect(
			await services.getMediaRepository().findByPath(sourceId, "keep.png"),
		).not.toBeNull();
		expect(
			(await services.getSourceRepository().findById(sourceId))?.syncStatus,
		).toBe("error");
	});

	it("publishes an attempt-owned artifact and resolves it without generic jobs", async () => {
		const run = await repo.createTransfer(sourceId, {
			kind: "export",
			mode: "ndjson",
			includeImages: false,
			sourceRevision: revision,
		});
		expect((await execute("export")).status).toBe("completed");
		const artifact = await resolveJobArtifact(run.id);
		expect(artifact).not.toBeNull();
		await artifact?.stream.cancel();
		const saved = await repo.findById(run.id);
		expect(saved?.artifact?.path).toContain(run.id + ".");
		expect(JSON.stringify(toSafeSourceRun(saved!))).not.toContain(
			getJobTransferRoot(),
		);
		expect(toSourceJobDto(saved!).artifact?.contentType).toBe(
			"application/x-ndjson",
		);
	});

	it("blocks stale source configuration before publishing output", async () => {
		const run = await repo.createTransfer(sourceId, {
			kind: "export",
			mode: "ndjson",
			includeImages: false,
			sourceRevision: revision,
		});
		await services
			.getSourceRepository()
			.update(sourceId, { connectionInfo: { path: directory + "-changed" } });
		expect(await execute("export")).toMatchObject({
			status: "blocked",
			failureCode: "source_changed",
			artifact: null,
		});
		expect(toSafeSourceRun((await repo.findById(run.id))!).canRetry).toBe(
			false,
		);
	});

	it("commits restore chunks with byte cursors and resumes only unapplied records", async () => {
		const lines: string[] = [];
		for (let i = 0; i < 101; i++) {
			const filePath = i + ".png";
			await fs.writeFile(path.join(directory, filePath), png);
			lines.push(
				JSON.stringify({
					filePath,
					fileName: filePath,
					mediaType: "image",
					description: "record " + i,
					sourceUrls: ["https://example.com/" + i],
				}),
			);
		}
		const input = await createInput(lines.join("\n") + "\n");
		const run = await repo.createTransfer(
			sourceId,
			{
				kind: "restore",
				mode: "ndjson",
				inputPath: input.inputPath,
				...(await fingerprintSourceInput(input.inputPath)),
				sourceRevision: revision,
			},
			input.id,
		);
		const original = repo.checkpoint.bind(repo);
		let calls = 0;
		vi.spyOn(repo, "checkpoint").mockImplementation(async (...args) => {
			calls++;
			if (calls === 2) throw new Error("Injected process interruption");
			return original(...args);
		});
		const failed = await execute("restore");
		expect(failed.status).toBe("failed");
		expect(failed.checkpoint.processed).toBe(100);
		expect(
			await db.select().from(medias).where(eq(medias.mediaSourceId, sourceId)),
		).toHaveLength(100);
		vi.restoreAllMocks();
		await repo.retry(run.id);
		const completed = await execute("restore");
		expect(completed.status).toBe("completed");
		expect(completed.checkpoint.processed).toBe(101);
		expect(completed.checkpoint.offset).toBe(
			Buffer.byteLength(lines.join("\n") + "\n"),
		);
		expect(await fs.stat(input.inputPath)).toBeDefined();
		expect(
			await db.select().from(medias).where(eq(medias.mediaSourceId, sourceId)),
		).toHaveLength(101);
	}, 30_000);

	it("serializes bulk metadata restores through the durable source queue", async () => {
		await fs.writeFile(path.join(directory, "bulk.png"), png);
		const restoring = sourceRunService.restoreItems(sourceId, [
			{ filePath: "bulk.png", fileName: "bulk.png", description: "first" },
			{ filePath: "bulk.png", fileName: "bulk.png", description: "last" },
		]);
		await vi.waitFor(async () =>
			expect(
				(
					await repo.list({
						sourceId,
						kind: "restore",
						status: "pending",
						limit: 1,
						offset: 0,
					})
				).total,
			).toBe(1),
		);
		const queued = (
			await repo.list({ sourceId, kind: "restore", limit: 1, offset: 0 })
		).items[0];
		if (queued.input?.kind === "restore") owned.push(queued.input.inputPath);
		expect((await execute("restore")).status).toBe("completed");
		expect(await restoring).toEqual({ processed: 2, skipped: 0 });
		expect(
			(await services.getMediaRepository().findByPath(sourceId, "bulk.png"))
				?.description,
		).toBe("last");
	});
	it("cleans expired owned input without a generic job lookup", async () => {
		const input = await createInput("{}\n");
		const run = await repo.createTransfer(
			sourceId,
			{
				kind: "restore",
				mode: "ndjson",
				inputPath: input.inputPath,
				...(await fingerprintSourceInput(input.inputPath)),
				sourceRevision: revision,
			},
			input.id,
		);
		await db
			.update(sourceTransferRuns)
			.set({ retentionExpiresAt: new Date(0) })
			.where(eq(sourceTransferRuns.id, run.id));
		await sourceRunService.cleanup();
		await expect(fs.access(input.inputPath)).rejects.toMatchObject({
			code: "ENOENT",
		});
		expect(await repo.findById(run.id)).toMatchObject({
			status: "blocked",
			input: null,
		});
	});
	it("rejects a modified retained input before applying it", async () => {
		const input = await createInput("{}\n");
		await repo.createTransfer(
			sourceId,
			{
				kind: "restore",
				mode: "ndjson",
				inputPath: input.inputPath,
				...(await fingerprintSourceInput(input.inputPath)),
				sourceRevision: revision,
			},
			input.id,
		);
		await fs.writeFile(input.inputPath, '{"description":"changed"}\n');
		expect(await execute("restore")).toMatchObject({
			status: "blocked",
			failureCode: "source_changed",
		});
	});

	it("restores TAR image bytes serially before metadata", async () => {
		await fs.mkdir(path.join(directory, "nested"));
		await fs.writeFile(path.join(directory, "nested", "one.png"), png);
		await BackupService.restoreSource(sourceId, [
			{
				filePath: "nested/one.png",
				fileName: "one.png",
				mediaType: "image",
				description: "from archive",
			},
		]);
		const dump = asDumpStream(
			await BackupService.createDump(sourceId, "tar", { includeImages: true }),
		);
		const input = await createInput("", "tar");
		const { createWriteStream } = await import("node:fs");
		const { pipeline } = await import("node:stream/promises");
		const { webReadableToNodeStream } =
			await import("~/infrastructure/utils/stream-utils");
		await pipeline(
			webReadableToNodeStream(dump),
			createWriteStream(input.inputPath),
		);
		await fs.rm(path.join(directory, "nested"), { recursive: true });
		await db.delete(medias).where(eq(medias.mediaSourceId, sourceId));
		await repo.createTransfer(
			sourceId,
			{
				kind: "restore",
				mode: "tar",
				inputPath: input.inputPath,
				...(await fingerprintSourceInput(input.inputPath)),
				sourceRevision: revision,
			},
			input.id,
		);
		const run = await execute("restore");
		expect(run.status).toBe("completed");
		expect(run.checkpoint).toMatchObject({
			filesComplete: true,
			processed: 1,
			fileCursor: "1",
		});
		expect(
			await fs.readFile(path.join(directory, "nested", "one.png")),
		).toEqual(png);
		expect(
			(
				await services
					.getMediaRepository()
					.findByPath(sourceId, "nested/one.png")
			)?.description,
		).toBe("from archive");
	}, 30_000);
});
