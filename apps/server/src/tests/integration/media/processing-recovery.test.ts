import {
	MediaProcessingSupersededError,
	serializeMediaProcessingInput,
} from "@solid-imager/core/domain/processing/schemas";
import { getMediaTaskRevision } from "@solid-imager/application/services/media-task-service";
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
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import { createTagRepository } from "@solid-imager/db/repositories/tag-repository";
import {
	jobs,
	medias,
	mediaSources,
	mediaGenerationInfo,
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
	let database: ReturnType<typeof drizzle>;
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
		directory = await mkdtemp(path.join(tmpdir(), "processing-recovery-"));
		client = createPglite(directory);
		database = drizzle(client);
		await migrate(database, { migrationsFolder: path.resolve("drizzle") });
	}, 30_000);
	afterAll(async () => {
		await client?.close();
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
	async function claim() {
		const claimed = await jobRepo.claimPending(1, {
			includeTypes: ["processMedia"],
		});
		expect(claimed).toHaveLength(1);
		return claimed[0];
	}
	async function register(file = "image.png") {
		return service.registerAndProcess(sourceId, file, {
			sourceUrls: ["https://example.com/image"],
		});
	}
	async function run(job: Job) {
		try {
			await service.executeProcessMediaJob(job);
			await jobRepo.markAsCompleted(job.id, null, job.attemptCount ?? 0);
		} catch (error) {
			await jobRepo.markAsFailed(job.id, String(error), job.attemptCount ?? 0);
			throw error;
		}
	}
	async function retry(job: Job) {
		await jobRepo.update(job.id, {
			status: "pending",
			error: null,
			result: null,
		});
		return claim();
	}

	it("rolls back media and context if job reservation fails, then registers once on retry", async () => {
		const create = vi
			.spyOn(jobRepo, "create")
			.mockRejectedValueOnce(new Error("queue unavailable"));
		await expect(register()).rejects.toThrow("queue unavailable");
		expect(await database.select().from(medias)).toHaveLength(0);
		expect(await database.select().from(mediaUrls)).toHaveLength(0);
		expect(deps.publishSourceEvent).not.toHaveBeenCalled();
		create.mockRestore();
		await register();
		expect(await database.select().from(medias)).toHaveLength(1);
		expect(await database.select().from(mediaUrls)).toHaveLength(1);
		expect(await database.select().from(jobs)).toHaveLength(1);
	});

	it("rolls back uploaded media, URLs and job together, preserving overwritten files", async () => {
		const upload = new MediaUploadService(
			mediaRepo,
			sourceRepo,
			deps.mediaStorage,
			jobRepo,
			transactionManager,
		);
		const file = new File(
			[new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
			"image.png",
			{ type: "image/png" },
		);
		vi.spyOn(jobRepo, "create").mockRejectedValue(
			new Error("queue unavailable"),
		);
		await expect(
			upload.uploadMedia(sourceId, file, {
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
			upload.uploadMedia(sourceId, file, { overwrite: true }),
		).rejects.toThrow();
		expect(deps.mediaStorage.deleteFile).not.toHaveBeenCalled();
	});

	it("reports scan registration failures and can safely resume the same scan", async () => {
		const upload = new MediaUploadService(
			mediaRepo,
			sourceRepo,
			deps.mediaStorage,
			jobRepo,
			transactionManager,
		);
		vi.spyOn(jobRepo, "create").mockRejectedValueOnce(
			new Error("queue unavailable"),
		);
		await expect(
			upload.registerExistingMedia(sourceId, "/fixture"),
		).rejects.toThrow("Some media could not be registered");
		expect(await database.select().from(medias)).toHaveLength(0);
		await upload.registerExistingMedia(sourceId, "/fixture");
		await upload.registerExistingMedia(sourceId, "/fixture");
		expect(await database.select().from(medias)).toHaveLength(1);
		expect(await database.select().from(jobs)).toHaveLength(1);
	});

	it("fails visibly, runs independent steps and retries only failed metadata without duplicating AI jobs", async () => {
		await register();
		extractMetadata.mockRejectedValueOnce(new Error("unreadable image"));
		const job = await claim();
		await expect(run(job)).rejects.toThrow("metadata");
		expect(
			(await jobRepo.findById(job.id))?.processingCheckpoint?.steps,
		).toMatchObject({
			metadata: { status: "failed", attemptCount: 1 },
			thumbnail: { status: "completed", attemptCount: 1 },
			ai_dispatch: { status: "completed", attemptCount: 1 },
		});
		await run(await retry(job));
		expect(extractMetadata).toHaveBeenCalledTimes(2);
		expect(prepareThumbnail).toHaveBeenCalledTimes(1);
		expect(await database.select().from(jobs)).toHaveLength(3);
		expect(await database.select().from(mediaGenerationInfo)).toHaveLength(1);
		expect(await database.select().from(mediaTags)).toHaveLength(1);
	});

	it("rolls back metadata output and retries it when linking tags fails", async () => {
		await register();
		vi.spyOn(tagRepo, "addTagsToMedia").mockRejectedValueOnce(
			new Error("tag write failed"),
		);
		const job = await claim();
		await expect(run(job)).rejects.toThrow("metadata");
		expect(await database.select().from(mediaGenerationInfo)).toHaveLength(0);
		await run(await retry(job));
		expect(await database.select().from(mediaGenerationInfo)).toHaveLength(1);
	});

	it("resumes durable checkpoints after closing and reopening the database", async () => {
		await register();
		// Simulate interruption after metadata committed and before thumbnail commit.
		prepareThumbnail.mockRejectedValueOnce(new JobAttemptLostError());
		const job = await claim();
		await expect(service.executeProcessMediaJob(job)).rejects.toThrow(
			JobAttemptLostError,
		);
		await database
			.update(jobs)
			.set({ updatedAt: new Date(0) })
			.where(eq(jobs.id, job.id));
		await client.close();
		client = createPglite(directory);
		database = drizzle(client);
		expect(await jobRepo.requeueStaleInProgress(new Date())).toBe(1);
		service = new MediaProcessingServiceImpl(deps);
		await run(await claim());
		expect(extractMetadata).toHaveBeenCalledTimes(1);
		expect(prepareThumbnail).toHaveBeenCalledTimes(2);
		expect(
			(await jobRepo.findById(job.id))?.processingCheckpoint?.steps.thumbnail,
		).toMatchObject({ status: "completed", attemptCount: 2 });
	});

	it("rejects stale attempts before publishing thumbnails or extending the new lease", async () => {
		await register();
		const old = await claim();
		let replacement: Job | undefined;
		prepareThumbnail.mockImplementationOnce(async () => {
			await database
				.update(jobs)
				.set({ updatedAt: new Date(0) })
				.where(eq(jobs.id, old.id));
			expect(await jobRepo.requeueStaleInProgress(new Date())).toBe(1);
			replacement = await claim();
			return { commit: commitThumbnail, cleanup: cleanupThumbnail };
		});
		await expect(service.executeProcessMediaJob(old)).rejects.toThrow(
			JobAttemptLostError,
		);
		expect(commitThumbnail).not.toHaveBeenCalled();
		expect(cleanupThumbnail).toHaveBeenCalledOnce();
		expect(await jobRepo.heartbeat(old.id, old.attemptCount ?? 0)).toBe(false);
		expect(
			await jobRepo.markAsFailed(old.id, "stale", old.attemptCount ?? 0),
		).toBe(false);
		expect(replacement?.attemptCount).toBe(2);
		if (!replacement) throw new Error("Replacement was not claimed");
		await run(replacement);
		expect(extractMetadata).toHaveBeenCalledOnce();
		expect(commitThumbnail).toHaveBeenCalledOnce();
	});

	it("fences cancellation before metadata can be committed", async () => {
		await register();
		const job = await claim();
		extractMetadata.mockImplementationOnce(async () => {
			await jobRepo.requestCancellation(job.id);
			expect(await jobRepo.heartbeat(job.id, job.attemptCount ?? 0)).toBe(
				false,
			);
			return { tags: [], prompt: "stale", workflow: null };
		});
		await expect(service.executeProcessMediaJob(job)).rejects.toThrow(
			JobAttemptLostError,
		);
		expect(await database.select().from(mediaGenerationInfo)).toHaveLength(0);
		expect(prepareThumbnail).not.toHaveBeenCalled();
	});

	it("invalidates old completed steps when the indexed input changes", async () => {
		const media = await register();
		prepareThumbnail.mockRejectedValueOnce(new Error("disk full"));
		const job = await claim();
		await expect(run(job)).rejects.toThrow("thumbnail");
		await mediaRepo.update(media.id, {
			modifiedAt: new Date("2026-02-01T00:00:00Z"),
		});
		await run(await retry(job));
		expect(extractMetadata).toHaveBeenCalledTimes(2);
		expect(
			(await jobRepo.findById(job.id))?.processingCheckpoint?.steps.metadata
				.attemptCount,
		).toBe(1);
	});

	it("does not commit extracted metadata after the media revision changed during extraction", async () => {
		const media = await register();
		const job = await claim();
		extractMetadata.mockImplementationOnce(async () => {
			await mediaRepo.update(media.id, { fileSize: 999 });
			return { tags: [], prompt: "stale", workflow: null };
		});
		await expect(run(job)).rejects.toThrow("metadata");
		expect(await database.select().from(mediaGenerationInfo)).toHaveLength(0);
		expect(commitThumbnail).not.toHaveBeenCalled();
		expect(await database.select().from(jobs)).toHaveLength(1);
	});

	it("keeps failed ingestion for explicit retry instead of duplicating it on startup", async () => {
		const media = await register();
		extractMetadata.mockRejectedValueOnce(new Error("unreadable"));
		await expect(run(await claim())).rejects.toThrow();
		expect(
			await jobRepo.createIfUnique({
				type: "processMedia",
				mediaSourceId: sourceId,
				payload: { mediaId: media.id, skipThumbnailGeneration: true },
			}),
		).toBeNull();
		expect(
			await jobRepo.createIfUnique({
				type: "processMedia",
				mediaSourceId: sourceId,
				payload: { mediaId: media.id, skipMetadataExtraction: true },
			}),
		).toBeNull();
		expect(
			await database.select().from(jobs).where(eq(jobs.type, "processMedia")),
		).toHaveLength(1);
	});

	it("serializes startup repair producers but permits complementary stages", async () => {
		const media = await register();
		await database.delete(jobs);
		const request = {
			type: "processMedia",
			mediaSourceId: sourceId,
			payload: { mediaId: media.id, skipThumbnailGeneration: true },
		};
		const reserved = await Promise.all([
			jobRepo.createIfUnique(request),
			jobRepo.createIfUnique(request),
		]);
		expect(reserved.filter(Boolean)).toHaveLength(1);
		expect(
			await jobRepo.createIfUnique({
				...request,
				payload: { mediaId: media.id, skipMetadataExtraction: true },
			}),
		).not.toBeNull();
		expect(await database.select().from(jobs)).toHaveLength(2);
	});

	it("rolls back AI reservation with its checkpoint when one enqueue fails", async () => {
		await register();
		vi.spyOn(jobRepo, "createIfUnique").mockRejectedValueOnce(
			new Error("CCIP enqueue failed"),
		);
		const job = await claim();
		await expect(run(job)).rejects.toThrow("ai_dispatch");
		expect(await database.select().from(jobs)).toHaveLength(1);
		await run(await retry(job));
		expect(await database.select().from(jobs)).toHaveLength(3);
		expect(extractMetadata).toHaveBeenCalledOnce();
		expect(prepareThumbnail).toHaveBeenCalledOnce();
	});

	it("keeps committed work complete even if cleanup or event listeners fail", async () => {
		vi.mocked(deps.publishSourceEvent).mockImplementation(() => {
			throw new Error("listener failed");
		});
		vi.mocked(deps.publishJobProgress).mockImplementation(() => {
			throw new Error("listener failed");
		});
		cleanupThumbnail.mockRejectedValueOnce(new Error("cleanup failed"));
		await register();
		const job = await claim();
		await run(job);
		expect((await jobRepo.findById(job.id))?.status).toBe("completed");
		expect(
			(await jobRepo.findById(job.id))?.processingCheckpoint?.steps.thumbnail
				.status,
		).toBe("completed");
	});

	it("honors legacy repair skip flags", async () => {
		const media = await register();
		const [queued] = await jobRepo.findPending(1);
		await jobRepo.update(queued.id, {
			payload: {
				mediaId: media.id,
				skipMetadataExtraction: true,
				skipThumbnailGeneration: true,
			},
		});
		const job = await claim();
		await run(job);
		expect(extractMetadata).not.toHaveBeenCalled();
		expect(prepareThumbnail).not.toHaveBeenCalled();
		const rows = await database.select().from(jobs);
		expect(rows.map((row) => row.type).sort()).toEqual([
			"extract_ccip_vector",
			"processMedia",
		]);
	});

	it("skips thumbnails and AI dispatch for audio", async () => {
		await register("sound.mp3");
		const job = await claim();
		await run(job);
		expect(
			(await jobRepo.findById(job.id))?.processingCheckpoint?.steps,
		).toMatchObject({
			thumbnail: { status: "skipped" },
			ai_dispatch: { status: "skipped" },
		});
		expect(prepareThumbnail).not.toHaveBeenCalled();
		expect(await database.select().from(jobs)).toHaveLength(1);
	});
	function gate() {
		let release!: () => void;
		const promise = new Promise<void>((resolve) => {
			release = resolve;
		});
		return { promise, release };
	}
	async function inputFor(mediaId: string) {
		const media = await mediaRepo.findById(mediaId);
		if (!media) throw new Error("Missing fixture");
		return {
			mediaId,
			mediaSourceId: sourceId,
			sourcePath: "/fixture",
			filePath: media.filePath,
			modifiedAt: media.modifiedAt,
			fileSize: media.fileSize,
			mediaType: media.mediaType,
		};
	}
	it("reuses media outputs across different completed jobs", async () => {
		const media = await register();
		const first = await claim();
		await run(first);
		const second = await jobRepo.create({
			type: "processMedia",
			mediaSourceId: sourceId,
			payload: { mediaId: media.id },
		});
		expect(second.id).not.toBe(first.id);
		await run(await claim());
		expect(extractMetadata).toHaveBeenCalledOnce();
		expect(prepareThumbnail).toHaveBeenCalledOnce();
		expect(await deps.processingStateRepo.findByMediaIds([media.id])).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					taskKind: "metadata",
					status: "completed",
					attemptCount: 1,
				}),
				expect.objectContaining({
					taskKind: "thumbnail",
					status: "completed",
					attemptCount: 1,
				}),
			]),
		);
	});
	it("coalesces concurrent direct requests and a running job", async () => {
		const media = await register();
		const entered = gate();
		const finish = gate();
		extractMetadata.mockImplementationOnce(async () => {
			entered.release();
			await finish.promise;
			return { tags: [], prompt: "shared", workflow: null };
		});
		const worker = run(await claim());
		await entered.promise;
		const reader = service.processTask(sourceId, media.id, "metadata");
		finish.release();
		await Promise.all([worker, reader]);
		expect(extractMetadata).toHaveBeenCalledOnce();
	});
	it("fences both stale success and stale failure after a newer revision completed", async () => {
		const media = await register();
		const entered = gate();
		const finish = gate();
		extractMetadata.mockImplementationOnce(async () => {
			entered.release();
			await finish.promise;
			return { tags: [], prompt: "old", workflow: null };
		});
		const old = service
			.processTask(sourceId, media.id, "metadata")
			.catch((error: unknown) => error);
		await entered.promise;
		await mediaRepo.update(media.id, { fileSize: 888 });
		await service.processTask(sourceId, media.id, "metadata");
		finish.release();
		expect(await old).toBeInstanceOf(MediaProcessingSupersededError);
		expect((await mediaRepo.getGenerationInfo(media.id))?.prompt).toBe(
			"new prompt",
		);
		expect(
			(await deps.processingStateRepo.findByMediaIds([media.id]))[0],
		).toMatchObject({ status: "completed", attemptCount: 1, lastError: null });
	});
	it("does not publish old thumbnail files after replacement processing", async () => {
		const media = await register();
		const entered = gate();
		const finish = gate();
		const oldCommit = vi.fn();
		const oldCleanup = vi.fn();
		prepareThumbnail.mockImplementationOnce(async () => {
			entered.release();
			await finish.promise;
			return { commit: oldCommit, cleanup: oldCleanup };
		});
		const old = service
			.processTask(sourceId, media.id, "thumbnail")
			.catch((error: unknown) => error);
		await entered.promise;
		await mediaRepo.update(media.id, { fileSize: 888 });
		await service.processTask(sourceId, media.id, "thumbnail");
		finish.release();
		expect(await old).toBeInstanceOf(MediaProcessingSupersededError);
		expect(oldCommit).not.toHaveBeenCalled();
		expect(oldCleanup).toHaveBeenCalledOnce();
		expect(commitThumbnail).toHaveBeenCalledOnce();
	});
	it("invalidates only the task whose settings changed", async () => {
		const media = await register();
		let settings = structuredClone(
			processingSettingsFromConfig(defaultAppConfig),
		);
		deps.getProcessingSettings = () => settings;
		await run(await claim());
		settings = {
			...settings,
			thumbnail: { ...settings.thumbnail, quality: 65 },
		};
		await service.processTask(sourceId, media.id, "metadata");
		await service.processTask(sourceId, media.id, "thumbnail");
		expect(extractMetadata).toHaveBeenCalledOnce();
		expect(prepareThumbnail).toHaveBeenCalledTimes(2);
		settings = {
			...settings,
			metadata: { ...settings.metadata, negativeTags: ["changed"] },
		};
		await service.processTask(sourceId, media.id, "metadata");
		expect(extractMetadata).toHaveBeenCalledTimes(2);
	});
	it("discards output if extraction settings changed while processing", async () => {
		const media = await register();
		let settings = structuredClone(
			processingSettingsFromConfig(defaultAppConfig),
		);
		deps.getProcessingSettings = () => settings;
		extractMetadata.mockImplementationOnce(async () => {
			settings = {
				...settings,
				metadata: { ...settings.metadata, negativeTags: [] },
			};
			return { tags: [], prompt: "stale", workflow: null };
		});
		await expect(
			service.processTask(sourceId, media.id, "metadata"),
		).rejects.toThrow(MediaProcessingSupersededError);
		expect(await mediaRepo.getGenerationInfo(media.id)).toBeNull();
		await service.processTask(sourceId, media.id, "metadata");
		expect((await mediaRepo.getGenerationInfo(media.id))?.prompt).toBe(
			"new prompt",
		);
	});
	it("repairs a missing cache once when two requests arrive together", async () => {
		const media = await register();
		await run(await claim());
		let cache = false;
		deps.hasThumbnails = async () => cache;
		const entered = gate();
		const finish = gate();
		prepareThumbnail.mockImplementationOnce(async () => {
			entered.release();
			await finish.promise;
			return {
				commit: async () => {
					cache = true;
				},
				cleanup: cleanupThumbnail,
			};
		});
		const first = service.processTask(sourceId, media.id, "thumbnail");
		await entered.promise;
		const second = service.processTask(sourceId, media.id, "thumbnail");
		finish.release();
		await Promise.all([first, second]);
		expect(prepareThumbnail).toHaveBeenCalledTimes(2);
	});
	it("replaces expired claims and rejects old tokens for commit, failure and heartbeat", async () => {
		const media = await register();
		const input = await inputFor(media.id);
		const repo = deps.processingStateRepo;
		const revision = getMediaTaskRevision(
			input,
			"metadata",
			deps.getProcessingSettings(),
		);
		const old = await transactionManager.transaction((tx) =>
			repo.claim(input, "metadata", revision, null, false, tx),
		);
		if (old.status !== "claimed") throw new Error("Expected claim");
		await database
			.update(mediaProcessingStates)
			.set({ heartbeatAt: new Date(0) });
		const next = await transactionManager.transaction((tx) =>
			repo.claim(input, "metadata", revision, null, false, tx),
		);
		expect(next.status).toBe("claimed");
		const output = vi.fn();
		await expect(
			transactionManager.transaction((tx) =>
				repo.commit(input, old.claim, output, tx),
			),
		).rejects.toThrow(MediaProcessingSupersededError);
		expect(output).not.toHaveBeenCalled();
		expect(
			await transactionManager.transaction((tx) =>
				repo.fail(old.claim, "old failure", tx),
			),
		).toBe(false);
		expect(await repo.heartbeat(old.claim)).toBe(false);
	});
	it("replaces generated tags and preserves manually attributed tags", async () => {
		const media = await register();
		await tagRepo.addTagsToMedia(
			media.id,
			[{ name: "recovered", type: "positive" }],
			"manual",
		);
		await service.processTask(sourceId, media.id, "metadata");
		extractMetadata.mockResolvedValue({
			tags: [{ name: "old-generated", type: "positive" }],
			prompt: null,
			workflow: null,
		});
		await service.processTask(sourceId, media.id, "metadata", undefined, true);
		extractMetadata.mockResolvedValue({
			tags: [],
			prompt: null,
			workflow: null,
		});
		await service.processTask(sourceId, media.id, "metadata", undefined, true);
		const links = await database
			.select()
			.from(mediaTags)
			.where(eq(mediaTags.mediaId, media.id));
		expect(links).toHaveLength(1);
		expect(links[0].source).toBe("manual");
	});
	it("coalesces concurrent producer reservations and permits a newer indexed input", async () => {
		const media = await register();
		await database.delete(jobs);
		const request = {
			type: "processMedia",
			mediaSourceId: sourceId,
			payload: { mediaId: media.id },
		};
		const reserved = await Promise.all(
			Array.from({ length: 8 }, () => jobRepo.create(request)),
		);
		expect(new Set(reserved.map((job) => job.id)).size).toBe(1);
		await mediaRepo.update(media.id, { fileSize: 987 });
		const latest = await jobRepo.create(request);
		expect(latest.id).not.toBe(reserved[0].id);
	});
	it("does not absorb changed settings into an active reservation", async () => {
		const media = await register();
		let settings = structuredClone(
			processingSettingsFromConfig(defaultAppConfig),
		);
		const repository = createJobRepository(executor, () => settings);
		const request = {
			type: "processMedia",
			mediaSourceId: sourceId,
			payload: { mediaId: media.id },
		};
		const first = await repository.create(request);
		settings = {
			...settings,
			thumbnail: { ...settings.thumbnail, quality: 44 },
		};
		const second = await repository.create(request);
		expect(second.id).not.toBe(first.id);
	});
	it("allows startup repair for a new revision even when an older job failed", async () => {
		const media = await register();
		extractMetadata.mockRejectedValueOnce(new Error("bad image"));
		await expect(run(await claim())).rejects.toThrow();
		await mediaRepo.update(media.id, { fileSize: 987 });
		expect(
			await jobRepo.createIfUnique({
				type: "processMedia",
				mediaSourceId: sourceId,
				payload: { mediaId: media.id },
			}),
		).not.toBeNull();
	});
	it("enforces claim/completion constraints and cascades state on media deletion", async () => {
		const media = await register();
		const values = {
			mediaId: media.id,
			taskKind: "metadata",
			status: "completed",
			inputRevision: serializeMediaProcessingInput(await inputFor(media.id)),
			requestedRevision: "revision",
		};
		await expect(
			database.insert(mediaProcessingStates).values(values),
		).rejects.toThrow();
		await expect(
			database
				.insert(mediaProcessingStates)
				.values({ ...values, status: "in_progress" }),
		).rejects.toThrow();
		await service.processTask(sourceId, media.id, "metadata");
		await mediaRepo.delete(media.id);
		expect(
			await deps.processingStateRepo.findByMediaIds([media.id]),
		).toHaveLength(0);
	});
});
