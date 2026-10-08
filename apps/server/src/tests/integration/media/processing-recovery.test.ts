import * as schema from "@solid-imager/db/schema";
import { Pool } from "pg";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { MediaProcessingSupersededError } from "@solid-imager/core/domain/processing/schemas";
import { mediaProcessingStates } from "@solid-imager/db/schema";
import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { processingSettingsFromConfig } from "@solid-imager/core/domain/processing/schemas";
import { createMediaProcessingStateRepository } from "@solid-imager/db/repositories/media-processing-state-repository";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	MediaProcessingServiceImpl,
	type MediaProcessingServiceDeps,
} from "@solid-imager/application/services/media-processing-service";
import { MediaUploadService } from "@solid-imager/application/services/media-upload-service";
import { JobAttemptLostError } from "@solid-imager/core/domain/jobs/schemas";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import { createTagRepository } from "@solid-imager/db/repositories/tag-repository";
import {
	jobs,
	medias,
	mediaSources,
	mediaTags,
	mediaUrls,
} from "@solid-imager/db/schema";
import { createTransactionManager } from "@solid-imager/db/transaction-manager";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createPglite } from "~/infrastructure/db/pglite";

describe("durable media processing", () => {
	let directory: string;
	let client: ReturnType<typeof createPglite>;
	let database: DrizzleExecutor;
	let postgres: Pool | undefined;
	// This test owns its DB; the application worker cannot claim its jobs.
	const executor = (tx?: unknown) => (tx ?? database) as DrizzleExecutor;
	const jobRepo = createJobRepository(executor);
	const mediaRepo = createMediaRepository(executor);
	const sourceRepo = createSourceRepository(executor);
	const tagRepo = createTagRepository(executor);
	const transactionManager = createTransactionManager(executor);
	let sourceId: string;
	let deps: MediaProcessingServiceDeps;
	let service: MediaProcessingServiceImpl;
	const extractMetadata =
		vi.fn<MediaProcessingServiceDeps["imageProcessor"]["extractMetadata"]>();
	const commitThumbnail = vi.fn<() => Promise<void>>();
	const cleanupThumbnail = vi.fn<() => Promise<void>>();
	const prepareThumbnail =
		vi.fn<MediaProcessingServiceDeps["prepareThumbnail"]>();
	const modifiedAt = new Date("2026-01-01T00:00:00Z");

	beforeAll(async () => {
		const port = process.env.PROCESSING_TEST_POSTGRES_PORT;
		if (port) {
			if (!/^\d+$/.test(port) || Number(port) <= 1024 || Number(port) > 65535)
				throw new Error("Invalid isolated PostgreSQL port");
			postgres = new Pool({
				host: "127.0.0.1",
				port: Number(port),
				user: "processing_test",
				password: "ephemeral_processing_test",
				database: "processing_scheduler_test",
				max: 8,
			});
			const pgDatabase = drizzlePostgres(postgres, { schema });
			await migratePostgres(pgDatabase, {
				migrationsFolder: path.resolve("drizzle"),
			});
			database = pgDatabase;
		} else {
			directory = await mkdtemp(path.join(tmpdir(), "processing-recovery-"));
			client = createPglite(directory);
			const local = drizzle(client, { schema });
			await migrate(local, { migrationsFolder: path.resolve("drizzle") });
			database = local;
		}
	}, 30_000);
	afterAll(async () => {
		await client?.close();
		await postgres?.end();
		if (directory) await rm(directory, { recursive: true, force: true });
	});
	beforeEach(async () => {
		vi.restoreAllMocks();
		await database.delete(jobs);
		await database.delete(mediaSources);
		sourceId = (
			await sourceRepo.create({
				name: "Recovery",
				description: null,
				type: "local",
				connectionInfo: { path: "/fixture" },
			})
		).id;
		extractMetadata.mockReset().mockResolvedValue({
			prompt: "new prompt",
			workflow: null,
			tags: [{ name: "recovered", type: "positive" }],
		});
		commitThumbnail.mockReset().mockResolvedValue();
		cleanupThumbnail.mockReset().mockResolvedValue();
		prepareThumbnail.mockReset().mockResolvedValue({
			commit: commitThumbnail,
			cleanup: cleanupThumbnail,
		});
		deps = {
			requestAiTasks: vi.fn(async (sourceId, mediaId, kinds, tx) => {
				const media = await mediaRepo.findById(mediaId, tx);
				if (!media) throw new Error("missing image");
				for (const kind of kinds)
					await deps.processingStateRepo.request(
						{
							input: {
								mediaId,
								mediaSourceId: sourceId,
								sourcePath: "/fixture",
								filePath: media.filePath,
								modifiedAt: media.modifiedAt,
								fileSize: media.fileSize,
								mediaType: media.mediaType,
							},
							taskKind: kind,
							revision: kind + "-fixture",
							force: false,
							maxAttempts: 5,
						},
						tx,
					);
			}),
			processingStateRepo: createMediaProcessingStateRepository(executor),
			getProcessingSettings: () =>
				processingSettingsFromConfig(defaultAppConfig),
			hasThumbnails: vi.fn().mockResolvedValue(true),
			transactionManager,
			sourceRepo,
			mediaRepo,
			tagRepo,
			jobRepo,
			authorRepo: {} as MediaProcessingServiceDeps["authorRepo"],
			characterRepo: {} as MediaProcessingServiceDeps["characterRepo"],
			ipRepo: {} as MediaProcessingServiceDeps["ipRepo"],
			projectRepo: {} as MediaProcessingServiceDeps["projectRepo"],
			imageProcessor: {
				extractMetadata,
				generateThumbnail: vi.fn(),
				getDimensions: vi.fn(),
			},
			mediaStorage: {
				getFileMetadata: vi.fn().mockResolvedValue({
					width: 100,
					height: 100,
					size: 512,
					createdAt: modifiedAt,
					modifiedAt,
				}),
				scanDirectory: vi.fn().mockResolvedValue(["/fixture/image.png"]),
				saveFile: vi.fn().mockResolvedValue({
					fileName: "image.png",
					filePath: "image.png",
					width: 100,
					height: 100,
					size: 512,
					createdAt: modifiedAt,
					modifiedAt,
				}),
				deleteFile: vi.fn(),
			} as unknown as MediaProcessingServiceDeps["mediaStorage"],
			enableAutoTagging: true,
			enableAutoCcipExtraction: true,
			supportedExtensions: {
				image: [".png"],
				video: [".mp4"],
				audio: [".mp3"],
			},
			prepareThumbnail,
			publishSourceEvent: vi.fn(),
			publishJobProgress: vi.fn(),
		};
		service = new MediaProcessingServiceImpl(deps);
	});

	async function register(file = "image.png") {
		return service.registerAndProcess(sourceId, file, {
			sourceUrls: ["https://example.com/image"],
		});
	}
	async function rows(mediaId: string) {
		return (await deps.processingStateRepo.findByMediaIds([mediaId])).filter(
			(row) => row.taskKind === "metadata" || row.taskKind === "thumbnail",
		);
	}
	async function task(mediaId: string, kind: "metadata" | "thumbnail") {
		return (await rows(mediaId)).find((row) => row.taskKind === kind);
	}
	async function finish() {
		await service.runFileTask("metadata");
		await service.runFileTask("thumbnail");
	}
	function gate() {
		let release!: () => void;
		const promise = new Promise<void>((resolve) => {
			release = resolve;
		});
		return { promise, release };
	}
	function upload() {
		return new MediaUploadService(
			mediaRepo,
			sourceRepo,
			deps.mediaStorage,
			service,
			transactionManager,
		);
	}
	const png = () =>
		new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "image.png", {
			type: "image/png",
		});
	it("reserves all file and AI tasks atomically without generic jobs", async () => {
		const media = await register();
		expect(await rows(media.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					taskKind: "metadata",
					executionMode: "scheduled",
					status: "pending",
				}),
				expect.objectContaining({
					taskKind: "thumbnail",
					executionMode: "scheduled",
					status: "pending",
				}),
			]),
		);
		expect(
			(await database.select().from(jobs)).map((job) => job.type).sort(),
		).toEqual([]);
		expect(
			(await deps.processingStateRepo.findByMediaIds([media.id]))
				.map((row) => row.taskKind)
				.sort(),
		).toEqual(["ccip", "metadata", "tagging", "thumbnail"]);
		expect(extractMetadata).not.toHaveBeenCalled();
		await finish();
		expect(
			(await rows(media.id)).every((row) => row.status === "completed"),
		).toBe(true);
	});
	it.each(["request", "ai"])(
		"rolls back registration and URLs on %s reservation failure",
		async (boundary) => {
			if (boundary === "request")
				vi.spyOn(deps.processingStateRepo, "request").mockRejectedValueOnce(
					new Error("queue unavailable"),
				);
			else
				vi.mocked(deps.requestAiTasks).mockRejectedValueOnce(
					new Error("queue unavailable"),
				);
			await expect(register()).rejects.toThrow("queue unavailable");
			expect(await database.select().from(medias)).toHaveLength(0);
			expect(await database.select().from(mediaUrls)).toHaveLength(0);
			expect(await database.select().from(mediaProcessingStates)).toHaveLength(
				0,
			);
			expect(await database.select().from(jobs)).toHaveLength(0);
			expect(deps.publishSourceEvent).not.toHaveBeenCalled();
			await register();
			expect(await database.select().from(medias)).toHaveLength(1);
		},
	);
	it("rolls back failed upload reservation and preserves overwritten files", async () => {
		vi.spyOn(deps.processingStateRepo, "request").mockRejectedValue(
			new Error("queue unavailable"),
		);
		await expect(
			upload().uploadMedia(sourceId, png(), {
				sourceUrl: "https://example.com/image",
			}),
		).rejects.toThrow();
		expect(deps.mediaStorage.deleteFile).toHaveBeenCalledWith(
			"/fixture",
			"image.png",
		);
		expect(await database.select().from(medias)).toHaveLength(0);
		expect(await database.select().from(mediaUrls)).toHaveLength(0);
		vi.mocked(deps.mediaStorage.deleteFile).mockClear();
		await expect(
			upload().uploadMedia(sourceId, png(), { overwrite: true }),
		).rejects.toThrow();
		expect(deps.mediaStorage.deleteFile).not.toHaveBeenCalled();
	});
	it("resumes a failed scan without duplicate requests", async () => {
		vi.spyOn(deps.processingStateRepo, "request").mockRejectedValueOnce(
			new Error("queue unavailable"),
		);
		await expect(
			upload().registerExistingMedia(sourceId, "/fixture"),
		).rejects.toThrow("Some media could not be registered");
		expect(await database.select().from(medias)).toHaveLength(0);
		await upload().registerExistingMedia(sourceId, "/fixture");
		await upload().registerExistingMedia(sourceId, "/fixture");
		expect(await database.select().from(medias)).toHaveLength(1);
		expect(await database.select().from(mediaProcessingStates)).toHaveLength(4);
	});
	it("runs independent file tasks and retries only an explicitly failed task", async () => {
		const media = await register();
		extractMetadata.mockRejectedValueOnce(new Error("unreadable image"));
		await finish();
		const old = await task(media.id, "metadata");
		expect(old).toMatchObject({ status: "failed", attemptCount: 1 });
		expect(await task(media.id, "thumbnail")).toMatchObject({
			status: "completed",
			attemptCount: 1,
		});
		await service.requestTask(sourceId, media.id, "metadata", true);
		expect((await task(media.id, "metadata"))?.requestId).not.toBe(
			old?.requestId,
		);
		await finish();
		expect(extractMetadata).toHaveBeenCalledTimes(2);
		expect(prepareThumbnail).toHaveBeenCalledOnce();
		expect(await database.select().from(jobs)).toHaveLength(0);
	});
	it("rolls back metadata and tag output together", async () => {
		const media = await register();
		vi.spyOn(tagRepo, "addTagsToMedia").mockRejectedValueOnce(
			new Error("tag write failed"),
		);
		await finish();
		expect(await mediaRepo.getGenerationInfo(media.id)).toBeNull();
		await service.requestTask(sourceId, media.id, "metadata", true);
		await finish();
		expect((await mediaRepo.getGenerationInfo(media.id))?.prompt).toBe(
			"new prompt",
		);
	});
	it.skipIf(!!process.env.PROCESSING_TEST_POSTGRES_PORT)(
		"reopens durable pending work without repeating completed extraction",
		async () => {
			const media = await register();
			await service.runFileTask("metadata");
			await client.close();
			client = createPglite(directory);
			database = drizzle(client, { schema });
			service = new MediaProcessingServiceImpl(deps);
			await service.reconcileFileTasks();
			await finish();
			expect(extractMetadata).toHaveBeenCalledOnce();
			expect(prepareThumbnail).toHaveBeenCalledOnce();
			expect(
				(await rows(media.id)).every((row) => row.status === "completed"),
			).toBe(true);
		},
	);
	it.each(["metadata", "thumbnail"] as const)(
		"coalesces direct and producer %s requests",
		async (kind) => {
			const media = await register();
			const request = await service.requestTask(sourceId, media.id, kind);
			const observer = service.processTask(sourceId, media.id, kind);
			await vi.waitFor(async () =>
				expect(await service.runFileTask(kind)).toBe("completed"),
			);
			await observer;
			expect((await task(media.id, kind))?.requestId).toBe(request?.requestId);
			expect(
				kind === "metadata" ? extractMetadata : prepareThumbnail,
			).toHaveBeenCalledOnce();
		},
	);
	it("a canceled compatibility observer does not own or cancel shared file computation", async () => {
		const media = await register();
		const job = await jobRepo.create({
			type: "processMedia",
			mediaSourceId: sourceId,
			payload: { mediaId: media.id },
		});
		const [claimed] = await jobRepo.claimPending(1, {
			includeTypes: ["processMedia"],
		});
		await jobRepo.requestCancellation(job.id);
		await expect(service.executeProcessMediaJob(claimed)).rejects.toThrow(
			JobAttemptLostError,
		);
		await finish();
		expect(await task(media.id, "metadata")).toMatchObject({
			status: "completed",
			ownerJobId: null,
		});
	});
	it("compatibility jobs observe file output and resume a failed checkpoint", async () => {
		const media = await register();
		extractMetadata.mockRejectedValueOnce(new Error("bad file"));
		await finish();
		await database.delete(jobs);
		const queued = await jobRepo.create({
			type: "processMedia",
			mediaSourceId: sourceId,
			payload: { mediaId: media.id },
		});
		const [first] = await jobRepo.claimPending(1, {
			includeTypes: ["processMedia"],
		});
		await expect(service.executeProcessMediaJob(first)).rejects.toThrow(
			"metadata",
		);
		await jobRepo.markAsFailed(first.id, "metadata", first.attemptCount ?? 0);
		await jobRepo.update(queued.id, {
			status: "pending",
			payload: { mediaId: media.id, retryFileTasks: true },
		});
		const [second] = await jobRepo.claimPending(1, {
			includeTypes: ["processMedia"],
		});
		const observer = service.executeProcessMediaJob(second);
		await vi.waitFor(async () =>
			expect(await task(media.id, "metadata")).toMatchObject({
				status: "pending",
			}),
		);
		await finish();
		await observer;
		expect(
			(await jobRepo.findById(queued.id))?.processingCheckpoint?.steps.metadata
				.status,
		).toBe("completed");
		expect(prepareThumbnail).toHaveBeenCalledOnce();
		expect(
			(await deps.processingStateRepo.findByMediaIds([media.id])).find(
				(row) => row.taskKind === "ccip",
			),
		).toMatchObject({ status: "pending", executionMode: "scheduled" });
		expect(
			(await database.select().from(jobs)).filter(
				(job) => job.type === "extract_ccip_vector",
			),
		).toHaveLength(0);
	});
	it.each(["metadata", "thumbnail"] as const)(
		"fences old %s output after a newer input completes",
		async (kind) => {
			const media = await register();
			const entered = gate();
			const release = gate();
			const oldCommit = vi.fn();
			const oldCleanup = vi.fn();
			if (kind === "metadata")
				extractMetadata.mockImplementationOnce(async () => {
					entered.release();
					await release.promise;
					return { tags: [], prompt: "stale", workflow: null };
				});
			else
				prepareThumbnail.mockImplementationOnce(async () => {
					entered.release();
					await release.promise;
					return { commit: oldCommit, cleanup: oldCleanup };
				});
			const old = service.runFileTask(kind);
			await entered.promise;
			await transactionManager.transaction(async (tx) => {
				const updated = await mediaRepo.update(media.id, { fileSize: 888 }, tx);
				await service.requestProcessing(
					updated,
					"/fixture",
					{ skipAi: true },
					tx,
				);
			});
			await service.runFileTask(kind);
			release.release();
			expect(await old).toBe("superseded");
			expect(await task(media.id, kind)).toMatchObject({
				status: "completed",
				attemptCount: 1,
			});
			if (kind === "metadata")
				expect((await mediaRepo.getGenerationInfo(media.id))?.prompt).toBe(
					"new prompt",
				);
			else {
				expect(oldCommit).not.toHaveBeenCalled();
				expect(oldCleanup).toHaveBeenCalledOnce();
			}
		},
	);
	it("invalidates only the task whose processing settings change", async () => {
		const media = await register();
		await finish();
		let settings = structuredClone(deps.getProcessingSettings());
		deps.getProcessingSettings = () => settings;
		settings = {
			...settings,
			thumbnail: { ...settings.thumbnail, quality: 65 },
		};
		await service.requestTask(sourceId, media.id, "metadata");
		await service.requestTask(sourceId, media.id, "thumbnail");
		await finish();
		expect(extractMetadata).toHaveBeenCalledOnce();
		expect(prepareThumbnail).toHaveBeenCalledTimes(2);
	});
	it("rejects extraction whose settings change while computing", async () => {
		const media = await register();
		let settings = structuredClone(deps.getProcessingSettings());
		deps.getProcessingSettings = () => settings;
		extractMetadata.mockImplementationOnce(async () => {
			settings = {
				...settings,
				metadata: { ...settings.metadata, negativeTags: ["changed"] },
			};
			return { tags: [], prompt: "stale", workflow: null };
		});
		expect(await service.runFileTask("metadata")).toBe("failed");
		expect(await mediaRepo.getGenerationInfo(media.id)).toBeNull();
		await service.requestTask(sourceId, media.id, "metadata");
		await finish();
		expect((await mediaRepo.getGenerationInfo(media.id))?.prompt).toBe(
			"new prompt",
		);
	});
	it("cache repair preserves terminal failures and automatic retry deadlines", async () => {
		const media = await register();
		prepareThumbnail.mockRejectedValueOnce(
			Object.assign(new Error("busy"), { code: "EBUSY" }),
		);
		expect(await service.runFileTask("thumbnail")).toBe("retry");
		const delayed = await task(media.id, "thumbnail");
		await service.requestTask(
			sourceId,
			media.id,
			"thumbnail",
			false,
			undefined,
			true,
		);
		expect(await task(media.id, "thumbnail")).toEqual(delayed);
		await database
			.update(mediaProcessingStates)
			.set({ availableAt: new Date(0) });
		prepareThumbnail.mockRejectedValueOnce(new Error("invalid image"));
		await service.runFileTask("thumbnail");
		const failed = await task(media.id, "thumbnail");
		await service.requestTask(
			sourceId,
			media.id,
			"thumbnail",
			false,
			undefined,
			true,
		);
		expect(await task(media.id, "thumbnail")).toEqual(failed);
	});
	it("repairs missing successful thumbnails once and rejects an older force observer", async () => {
		const media = await register();
		await finish();
		const old = await task(media.id, "thumbnail");
		if (!old) throw new Error("fixture");
		deps.hasThumbnails = async () => false;
		const requests = await Promise.all([
			service.requestTask(
				sourceId,
				media.id,
				"thumbnail",
				false,
				undefined,
				true,
			),
			service.requestTask(
				sourceId,
				media.id,
				"thumbnail",
				false,
				undefined,
				true,
			),
		]);
		expect(requests[0]?.requestId).toBe(requests[1]?.requestId);
		expect(requests[0]?.requestId).not.toBe(old.requestId);
		await service.runFileTask("thumbnail");
		await expect(
			service.waitForTask(media.id, "thumbnail", old),
		).rejects.toThrow(MediaProcessingSupersededError);
		expect(prepareThumbnail).toHaveBeenCalledTimes(2);
	});
	it("promotes inline completed/failed states without resetting failures or outputs", async () => {
		const media = await register();
		await finish();
		await database
			.update(mediaProcessingStates)
			.set({ executionMode: "inline" });
		await database
			.update(mediaProcessingStates)
			.set({ status: "failed", lastError: "unreadable" })
			.where(eq(mediaProcessingStates.taskKind, "thumbnail"));
		await service.reconcileFileTasks();
		expect(await task(media.id, "metadata")).toMatchObject({
			executionMode: "scheduled",
			status: "completed",
		});
		expect(await task(media.id, "thumbnail")).toMatchObject({
			executionMode: "scheduled",
			status: "failed",
			lastError: "unreadable",
		});
		await finish();
		expect(extractMetadata).toHaveBeenCalledOnce();
	});
	it("rejects every inline file claim, including before a scheduled row exists", async () => {
		const media = await register();
		await database.delete(mediaProcessingStates);
		const input = {
			mediaId: media.id,
			mediaSourceId: sourceId,
			sourcePath: "/fixture",
			filePath: media.filePath,
			fileSize: media.fileSize,
			modifiedAt: media.modifiedAt,
			mediaType: media.mediaType,
		};
		await expect(
			transactionManager.transaction((tx) =>
				deps.processingStateRepo.claim(
					input,
					"metadata",
					"v1",
					null,
					false,
					tx,
				),
			),
		).rejects.toThrow("dedicated scheduler");
	});
	it("keeps manual tags while replacing extracted tags", async () => {
		const media = await register();
		await tagRepo.addTagsToMedia(
			media.id,
			[{ name: "recovered", type: "positive" }],
			"manual",
		);
		await service.runFileTask("metadata");
		extractMetadata.mockResolvedValue({
			tags: [],
			prompt: null,
			workflow: null,
		});
		await service.requestTask(sourceId, media.id, "metadata", true);
		await finish();
		const links = await database
			.select()
			.from(mediaTags)
			.where(eq(mediaTags.mediaId, media.id));
		expect(links).toHaveLength(1);
		expect(links[0].source).toBe("manual");
	});
	it("does not fail committed work when notifications or cleanup fail", async () => {
		const media = await register();
		vi.mocked(deps.publishSourceEvent).mockImplementation(() => {
			throw new Error("listener");
		});
		cleanupThumbnail.mockRejectedValueOnce(new Error("cleanup"));
		await finish();
		expect(
			(await rows(media.id)).every((row) => row.status === "completed"),
		).toBe(true);
	});
	it("skips thumbnail and AI work for audio", async () => {
		const media = await register("sound.mp3");
		await finish();
		expect(await rows(media.id)).toHaveLength(1);
		expect(prepareThumbnail).not.toHaveBeenCalled();
		expect(await database.select().from(jobs)).toHaveLength(0);
	});
	it("cascades requests on deletion and fails an observer of the deleted request", async () => {
		const media = await register();
		const request = await service.requestTask(sourceId, media.id, "metadata");
		if (!request) throw new Error("fixture");
		await mediaRepo.delete(media.id);
		expect(await rows(media.id)).toHaveLength(0);
		await expect(
			service.waitForTask(media.id, "metadata", request),
		).rejects.toThrow(MediaProcessingSupersededError);
	});
	it("coalesces repeated producer calls without reserving AI twice", async () => {
		const media = await register();
		const original = await deps.processingStateRepo.findByMediaIds([media.id]);
		await Promise.all(
			Array.from({ length: 8 }, () =>
				transactionManager.transaction((tx) =>
					service.requestProcessing(media, "/fixture", {}, tx),
				),
			),
		);
		expect(await database.select().from(jobs)).toHaveLength(0);
		expect(await deps.processingStateRepo.findByMediaIds([media.id])).toEqual(
			original,
		);
	});
	it("handoff promotes only existing file kinds and preserves restored metadata", async () => {
		const media = await register();
		await finish();
		await database
			.delete(mediaProcessingStates)
			.where(eq(mediaProcessingStates.taskKind, "metadata"));
		await database
			.update(mediaProcessingStates)
			.set({ executionMode: "inline" });
		await service.reconcileFileTasks();
		await finish();
		expect(await rows(media.id)).toHaveLength(1);
		expect(extractMetadata).toHaveBeenCalledOnce();
	});
	it("does not let an obsolete nonlocal source prevent other startup handoffs", async () => {
		const media = await register();
		await finish();
		await database
			.update(mediaProcessingStates)
			.set({ executionMode: "inline" });
		await sourceRepo.update(sourceId, {
			type: "s3",
			connectionInfo: {
				region: "test",
				bucket: "test",
				accessKeyId: "test",
				secretAccessKey: "test",
			},
		});
		await expect(service.reconcileFileTasks()).resolves.toBeUndefined();
		expect(
			(await rows(media.id)).every((row) => row.executionMode === "inline"),
		).toBe(true);
	});

	it("a stale compatibility observer cannot reset a terminal file request", async () => {
		const media = await register();
		extractMetadata.mockRejectedValueOnce(new Error("invalid file"));
		await finish();
		await database.delete(jobs);
		const queued = await jobRepo.create({
			type: "processMedia",
			mediaSourceId: sourceId,
			payload: { mediaId: media.id },
		});
		const [first] = await jobRepo.claimPending(1, {
			includeTypes: ["processMedia"],
		});
		await expect(service.executeProcessMediaJob(first)).rejects.toThrow(
			"metadata",
		);
		const terminal = await task(media.id, "metadata");
		await database
			.update(jobs)
			.set({ updatedAt: new Date(0) })
			.where(eq(jobs.id, queued.id));
		await jobRepo.requeueStaleInProgress(new Date());
		const [second] = await jobRepo.claimPending(1, {
			includeTypes: ["processMedia"],
		});
		await expect(service.executeProcessMediaJob(second)).rejects.toThrow(
			"metadata",
		);
		expect(await task(media.id, "metadata")).toEqual(terminal);
		expect(extractMetadata).toHaveBeenCalledOnce();
	});
});
