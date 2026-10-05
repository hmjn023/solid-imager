import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	CcipVectorService,
	getCcipTaskRevision,
} from "@solid-imager/application/services/ccip-vector-service";
import {
	CCIP_MODEL,
	CCIP_EMBEDDING_VERSION,
	CCIP_VECTOR_DIMENSIONS,
	MediaProcessingSupersededError,
	type CcipProcessingSettings,
} from "@solid-imager/core/domain/processing/schemas";
import type { CcipFeatureResponse } from "@solid-imager/core/domain/tagging/schemas";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import { createMediaProcessingStateRepository } from "@solid-imager/db/repositories/media-processing-state-repository";
import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import * as schema from "@solid-imager/db/schema";
import { createTransactionManager } from "@solid-imager/db/transaction-manager";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { PostgresCcipVectorStore } from "~/infrastructure/ai/postgres-ccip-vector-store";
import { createPglite } from "~/infrastructure/db/pglite";
import {
	scanCcipTargetPage,
	findQueuedCcipJob,
} from "~/infrastructure/jobs/ccip-targets";

const feature = (value = 1): CcipFeatureResponse => ({
	feature: Array.from({ length: CCIP_VECTOR_DIMENSIONS }, () => value),
});
describe("revision-aware full-image CCIP", () => {
	let directory: string;
	let client: ReturnType<typeof createPglite> | undefined;
	let postgres: Pool | undefined;
	let database: DrizzleExecutor;
	const executor = (tx?: unknown) => (tx ?? database) as DrizzleExecutor;
	const transactionManager = createTransactionManager(executor);
	const mediaRepository = createMediaRepository(executor);
	const sourceRepository = createSourceRepository(executor);
	const processingStateRepo = createMediaProcessingStateRepository(executor);
	const jobRepo = createJobRepository(executor);
	const infer = vi.fn<() => Promise<CcipFeatureResponse>>();
	let store: PostgresCcipVectorStore;
	let settings: CcipProcessingSettings;
	let sourceId: string;
	let mediaId: string;
	let service: CcipVectorService;
	const query = () => ({
		model: settings.model,
		embeddingVersion: settings.embeddingVersion,
	});
	const run = (
		force = false,
		owner?: Parameters<CcipVectorService["extract"]>[3],
	) => service.extract(sourceId, mediaId, force, owner);
	const state = async () =>
		(await processingStateRepo.findByMediaIds([mediaId])).find(
			(row) => row.taskKind === "ccip",
		);
	async function input() {
		const media = await mediaRepository.findById(mediaId);
		const source = await sourceRepository.findById(sourceId);
		if (!media || !source) throw new Error("Fixture missing");
		return {
			mediaId,
			mediaSourceId: sourceId,
			mediaType: media.mediaType,
			sourcePath: "/fixture",
			filePath: media.filePath,
			modifiedAt: media.modifiedAt,
			fileSize: media.fileSize,
		};
	}
	function createFixtureMedia(filePath = "image.png") {
		return mediaRepository.create({
			mediaSourceId: sourceId,
			filePath,
			fileName: filePath,
			mediaType: "image",
			fileSize: 100,
			width: 16,
			height: 16,
			description: null,
			createdAt: new Date("2026-01-01"),
			modifiedAt: new Date("2026-01-01"),
		});
	}
	function createService() {
		return new CcipVectorService({
			mediaRepository,
			sourceRepository,
			processingStateRepo,
			transactionManager,
			jobRepo,
			vectorStore: store,
			getCcipSettings: () => settings,
			taggingService: {
				getCcipFeatureForMedia: infer,
				getCcipDistances: vi.fn().mockResolvedValue([0.1]),
			} as any,
		});
	}
	function delayed() {
		const started = Promise.withResolvers<void>();
		const response = Promise.withResolvers<CcipFeatureResponse>();
		infer.mockImplementationOnce(() => {
			started.resolve();
			return response.promise;
		});
		const pending = run().then(
			(value) => ({ value }),
			(error: unknown) => ({ error }),
		);
		return {
			started: started.promise,
			pending,
			resolve: response.resolve,
			reject: response.reject,
		};
	}
	beforeAll(async () => {
		const port = process.env.CCIP_TEST_POSTGRES_PORT;
		if (port) {
			if (!/^\d+$/.test(port) || Number(port) <= 1024 || Number(port) > 65535)
				throw new Error("Invalid isolated PostgreSQL port");
			postgres = new Pool({
				host: "127.0.0.1",
				port: Number(port),
				user: "ccip_test",
				password: "ephemeral_ccip_test",
				database: "ccip_processing_test",
				max: 12,
			});
			const pgDatabase = drizzlePostgres(postgres, { schema });
			await migratePostgres(pgDatabase, {
				migrationsFolder: path.resolve("drizzle"),
			});
			database = pgDatabase;
		} else {
			directory = await mkdtemp(path.join(tmpdir(), "ccip-processing-"));
			client = createPglite(directory);
			database = drizzle(client, { schema });
			await migrate(database, { migrationsFolder: path.resolve("drizzle") });
		}
	}, 30_000);
	afterAll(async () => {
		await client?.close();
		await postgres?.end();
		if (directory) await rm(directory, { recursive: true, force: true });
	});
	beforeEach(async () => {
		vi.restoreAllMocks();
		await database.delete(schema.jobs);
		await database.delete(schema.mediaSources);
		settings = {
			model: CCIP_MODEL,
			modelVersion: "native-v1",
			runtimeVersion: "test-v1",
			provider: "cpu",
			device: null,
			endpoint: "",
			embeddingVersion: CCIP_EMBEDDING_VERSION,
			dimensions: CCIP_VECTOR_DIMENSIONS,
		};
		infer.mockReset().mockResolvedValue(feature());
		sourceId = (
			await sourceRepository.create({
				name: "CCIP fixture",
				description: null,
				type: "local",
				connectionInfo: { path: "/fixture" },
			})
		).id;
		mediaId = (await createFixtureMedia()).id;
		store = new PostgresCcipVectorStore(database);
		service = createService();
	});
	it("commits the vector and state, reuses it across service recreation, and forces a later request", async () => {
		const first = await run();
		expect(first.skipped).toBe(false);
		expect((await state())?.status).toBe("completed");
		service = createService();
		expect((await run()).record).toEqual(first.record);
		expect(infer).toHaveBeenCalledOnce();
		await run(true);
		expect(infer).toHaveBeenCalledTimes(2);
		expect((await state())?.attemptCount).toBe(2);
		expect(await service.getStatus(sourceId, mediaId)).toMatchObject({
			status: "ready",
		});
	});
	it("retains legacy output but re-extracts without a successful state", async () => {
		await store.upsert({
			mediaId,
			mediaSourceId: sourceId,
			vector: feature(2).feature,
			model: settings.model,
			embeddingVersion: 1,
			mediaModifiedAt: new Date("2026-01-01"),
			extractedAt: new Date(),
		});
		expect(await service.getStatus(sourceId, mediaId)).toMatchObject({
			status: "stale",
		});
		await run();
		expect(infer).toHaveBeenCalledOnce();
		expect((await store.get(mediaId, query()))?.processingRevision).toBe(
			getCcipTaskRevision(await input(), settings),
		);
	});
	it("replaces legacy future timestamps under the current claim", async () => {
		await store.upsert({
			mediaId,
			mediaSourceId: sourceId,
			vector: feature(2).feature,
			model: settings.model,
			embeddingVersion: 1,
			mediaModifiedAt: new Date("2026-01-01"),
			extractedAt: new Date("2099-01-01"),
		});
		await run();
		expect((await store.get(mediaId, query()))?.vector).toEqual(
			feature().feature,
		);
		expect(await service.getStatus(sourceId, mediaId)).toMatchObject({
			status: "ready",
		});
	});
	it("repairs a missing vector rather than trusting a completed state", async () => {
		await run();
		await store.delete(mediaId);
		expect(await service.getStatus(sourceId, mediaId)).toEqual({
			status: "missing",
		});
		await run();
		expect(infer).toHaveBeenCalledTimes(2);
	});
	it("coalesces concurrent forced requests", async () => {
		const old = delayed();
		await old.started;
		const busy = Promise.withResolvers<void>();
		const claim = processingStateRepo.claim.bind(processingStateRepo);
		vi.spyOn(processingStateRepo, "claim").mockImplementation(
			async (...args) => {
				const result = await claim(...args);
				if (result.status === "busy") busy.resolve();
				return result;
			},
		);
		const next = run(true);
		await busy.promise;
		old.resolve(feature());
		await old.pending;
		expect((await next).skipped).toBe(true);
		expect(infer).toHaveBeenCalledOnce();
	});
	for (const key of [
		"modelVersion",
		"runtimeVersion",
		"provider",
		"device",
		"embeddingVersion",
		"dimensions",
	] as const) {
		it(`rejects an old output after ${key} changes`, async () => {
			const old = delayed();
			await old.started;
			if (key === "embeddingVersion" || key === "dimensions")
				settings = { ...settings, [key]: settings[key] + 1 };
			else settings = { ...settings, [key]: "changed" };
			old.resolve(feature(2));
			expect(await old.pending).toMatchObject({
				error: expect.any(MediaProcessingSupersededError),
			});
			expect(await store.get(mediaId, query())).toBeNull();
		});
	}
	for (const key of ["fileSize", "filePath", "modifiedAt"] as const) {
		it(`rejects an old output after indexed ${key} changes`, async () => {
			const old = delayed();
			await old.started;
			if (key === "fileSize")
				await database
					.update(schema.medias)
					.set({ fileSize: 200 })
					.where(eq(schema.medias.id, mediaId));
			else if (key === "filePath")
				await database
					.update(schema.medias)
					.set({ filePath: "other.png" })
					.where(eq(schema.medias.id, mediaId));
			else
				await database
					.update(schema.medias)
					.set({ modifiedAt: new Date("2026-01-02") })
					.where(eq(schema.medias.id, mediaId));
			old.resolve(feature(2));
			expect(await old.pending).toMatchObject({
				error: expect.any(MediaProcessingSupersededError),
			});
			expect(await store.get(mediaId, query())).toBeNull();
		});
	}
	it("rejects an old output after the source path changes", async () => {
		const old = delayed();
		await old.started;
		await database
			.update(schema.mediaSources)
			.set({ connectionInfo: { path: "/other" } })
			.where(eq(schema.mediaSources.id, sourceId));
		old.resolve(feature());
		expect(await old.pending).toMatchObject({
			error: expect.any(MediaProcessingSupersededError),
		});
	});
	for (const outcome of ["success", "failure"] as const) {
		it(`keeps the new claim's output after old ${outcome}`, async () => {
			const old = delayed();
			await old.started;
			await database
				.update(schema.mediaProcessingStates)
				.set({ heartbeatAt: new Date(0) })
				.where(
					and(
						eq(schema.mediaProcessingStates.mediaId, mediaId),
						eq(schema.mediaProcessingStates.taskKind, "ccip"),
					),
				);
			await run();
			if (outcome === "success") old.resolve(feature(3));
			else old.reject(new Error("old failure"));
			expect(await old.pending).toHaveProperty("error");
			expect((await state())?.status).toBe("completed");
			expect((await store.get(mediaId, query()))?.vector).toEqual(
				feature().feature,
			);
		});
	}
	it("rolls back a written vector if the save boundary fails", async () => {
		const write = store.upsert.bind(store);
		vi.spyOn(store, "upsert").mockImplementationOnce(async (...args) => {
			await write(...args);
			throw new Error("save failure");
		});
		await expect(run()).rejects.toThrow("save failure");
		expect(await store.get(mediaId, query())).toBeNull();
		expect(await database.select().from(schema.mediaRegions)).toHaveLength(0);
		expect((await state())?.status).toBe("failed");
		await run();
		expect((await state())?.status).toBe("completed");
	});
	it("records invalid zero-norm inference as a failed task without any output", async () => {
		infer.mockResolvedValueOnce(feature(0));
		await expect(run()).rejects.toThrow("zero norm");
		expect(await store.get(mediaId, query())).toBeNull();
		expect((await state())?.status).toBe("failed");
		expect(await service.getStatus(sourceId, mediaId)).toEqual({
			status: "failed",
			jobId: undefined,
			error: "CCIP vector extraction failed",
		});
	});
	it("preserves independent task states", async () => {
		const data = await input();
		await transactionManager.transaction(async (tx) => {
			const claim = await processingStateRepo.claim(
				data,
				"metadata",
				"metadata-revision",
				null,
				false,
				tx,
			);
			if (claim.status !== "claimed") throw new Error("claim");
			await processingStateRepo.commit(data, claim.claim, async () => {}, tx);
		});
		infer.mockRejectedValueOnce(new Error("CCIP temporary failure"));
		await expect(run()).rejects.toThrow("CCIP temporary failure");
		await run();
		expect(
			(await processingStateRepo.findByMediaIds([mediaId])).map((row) => [
				row.taskKind,
				row.status,
			]),
		).toEqual(
			expect.arrayContaining([
				["metadata", "completed"],
				["ccip", "completed"],
			]),
		);
	});
	for (const change of ["cancel", "attempt"] as const) {
		it(`fences output after owner ${change}`, async () => {
			const job = await jobRepo.create({
				type: "extract_ccip_vector",
				mediaSourceId: sourceId,
				payload: { mediaId },
			});
			await jobRepo.markAsInProgress(job.id);
			const active = await jobRepo.findById(job.id);
			if (!active) throw new Error("job");
			const response = Promise.withResolvers<CcipFeatureResponse>();
			const started = Promise.withResolvers<void>();
			infer.mockImplementationOnce(() => {
				started.resolve();
				return response.promise;
			});
			const pending = run(false, {
				jobId: job.id,
				attemptCount: active.attemptCount ?? 0,
			}).catch((error) => error);
			await started.promise;
			expect(await service.getStatus(sourceId, mediaId)).toMatchObject({
				status: "processing",
				jobId: job.id,
			});
			if (change === "cancel") await jobRepo.requestCancellation(job.id);
			else
				await database
					.update(schema.jobs)
					.set({ attemptCount: (active.attemptCount ?? 0) + 1 })
					.where(eq(schema.jobs.id, job.id));
			response.resolve(feature());
			expect(await pending).toBeInstanceOf(Error);
			expect(await store.get(mediaId, query())).toBeNull();
		});
	}
	it("does not recreate output for a deleted media", async () => {
		const old = delayed();
		await old.started;
		await mediaRepository.delete(mediaId);
		old.resolve(feature());
		expect(await old.pending).toHaveProperty("error");
		expect(await state()).toBeUndefined();
		expect(await database.select().from(schema.ccipEmbeddings)).toHaveLength(0);
	});
	it("commits successful batch items individually and only retries failed items", async () => {
		const second = await createFixtureMedia("second.png");
		infer
			.mockResolvedValueOnce(feature())
			.mockRejectedValueOnce(new Error("AI down"));
		const first = await service.extractBatch(sourceId, [mediaId, second.id]);
		expect(first.map((result) => result.status)).toEqual([
			"fulfilled",
			"rejected",
		]);
		const retry = await service.extractBatch(sourceId, [mediaId, second.id]);
		expect(retry.map((result) => result.status)).toEqual([
			"fulfilled",
			"fulfilled",
		]);
		expect(infer).toHaveBeenCalledTimes(3);
		expect(await store.get(mediaId, query())).not.toBeNull();
	});
	it("keeps scanning past cached pages and targets legacy/changed-model/forced outputs", async () => {
		await run();
		const scan = (options: { afterId?: string; force?: boolean } = {}) =>
			scanCcipTargetPage(
				{ limit: 1, force: options.force ?? false, afterId: options.afterId },
				database,
				settings,
				(ids) => store.getMetadataMany(ids, query()),
			);
		const cached = await scan();
		expect(cached.targets).toHaveLength(0);
		expect(cached.nextCursor).toBe(mediaId);
		const second = await createFixtureMedia("second.png");
		const next = await scan({ afterId: cached.nextCursor });
		expect(next.targets).toEqual([{ id: second.id, mediaSourceId: sourceId }]);
		expect(
			(await scan({ afterId: next.nextCursor })).nextCursor,
		).toBeUndefined();
		expect((await scan({ force: true })).targets).toHaveLength(1);
		settings = { ...settings, runtimeVersion: "test-v2" };
		expect((await scan()).targets).toHaveLength(1);
	});
	it("marks a cached vector stale and excludes it from similarity search after settings change", async () => {
		await run();
		settings = { ...settings, runtimeVersion: "v2" };
		expect(await service.getStatus(sourceId, mediaId)).toMatchObject({
			status: "stale",
		});
		await expect(service.searchSimilar(mediaId, 5)).rejects.toThrow(
			"missing or stale",
		);
	});
	it("does not persistently reuse results with an unknown remote identity", async () => {
		settings = {
			...settings,
			endpoint: "https://ai.example",
			modelVersion: "unknown",
			runtimeVersion: "unknown",
		};
		await run();
		await run();
		expect(infer).toHaveBeenCalledTimes(2);
	});
	it("restores queued single and multi-media requests and excludes cancellation", async () => {
		const queued = await jobRepo.create({
			type: "extract_ccip_vector",
			mediaSourceId: sourceId,
			payload: { mediaIds: [mediaId] },
		});
		expect(await findQueuedCcipJob(sourceId, mediaId, database)).toEqual({
			id: queued.id,
		});
		await jobRepo.requestCancellation(queued.id);
		expect(await findQueuedCcipJob(sourceId, mediaId, database)).toBeNull();
		const single = await jobRepo.create({
			type: "extract_ccip_vector",
			mediaSourceId: sourceId,
			payload: { mediaId },
		});
		expect(await findQueuedCcipJob(sourceId, mediaId, database)).toEqual({
			id: single.id,
		});
	});
	it("canonicalizes revision irrespective of settings property order", async () => {
		const data = await input();
		expect(getCcipTaskRevision(data, settings)).toBe(
			getCcipTaskRevision(data, {
				dimensions: settings.dimensions,
				embeddingVersion: settings.embeddingVersion,
				endpoint: settings.endpoint,
				device: settings.device,
				provider: settings.provider,
				runtimeVersion: settings.runtimeVersion,
				modelVersion: settings.modelVersion,
				model: settings.model,
			}),
		);
	});
});
