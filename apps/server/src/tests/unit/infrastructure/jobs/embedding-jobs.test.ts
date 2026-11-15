import path from "node:path";
import {
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
} from "@solid-imager/core/search";
import { importWorkOwner, type IJobRepository } from "@solid-imager/core/jobs";
import { listBatchTargets } from "~/infrastructure/services/job-batch-targets";
import { runImportSubmission } from "~/infrastructure/services/import-submission";
import { createImportBatch, createRepositories } from "@solid-imager/db";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import { assert, afterEach, describe, expect, it, vi } from "vitest";
import { PostgresEmbeddingStore } from "~/infrastructure/ai/postgres-embedding-store";
import { createPglite } from "~/infrastructure/db/pglite";
import * as schema from "~/infrastructure/db/schema";

const mocks = vi.hoisted(() => ({
	database: undefined as any,
	repository: undefined as any,
	extract: vi.fn(),
	publishJob: vi.fn(),
	info: vi.fn(),
	error: vi.fn(),
}));
vi.mock("~/infrastructure/db", () => ({
	get db() {
		return mocks.database;
	},
}));
vi.mock("~/infrastructure/db/repositories", () => ({
	get JobRepository() {
		return mocks.repository;
	},
}));
vi.mock("~/infrastructure/service-registry", () => ({
	services: { getJobRepository: () => mocks.repository },
}));
vi.mock("~/infrastructure/services/embedding-search-service", () => ({
	getEmbeddingSearchService: () => ({ extract: mocks.extract }),
}));
vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: { publishJob: mocks.publishJob },
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { info: mocks.info, error: mocks.error },
}));
import {
	countEmbeddingTargets,
	queueEmbeddingBatch,
	processEmbeddingBatchJob,
	processEmbeddingExtractionJob,
} from "~/infrastructure/jobs/embedding-jobs";

const sourceId = "11111111-1111-4111-8111-111111111111";
const otherSourceId = "44444444-4444-4444-8444-444444444444";
const ids = [
	"22222222-2222-4222-8222-222222222222",
	"33333333-3333-4333-8333-333333333333",
	"55555555-5555-4555-8555-555555555555",
];
const modifiedAt = new Date("2026-01-01");
const vector = (a: number, b = 0) =>
	Array.from({ length: 768 }, (_, index) =>
		index === 0 ? a : index === 1 ? b : 0,
	);

describe("EmbeddingGemma 2 pgvector indexing and jobs", () => {
	let client: ReturnType<typeof createPglite>;
	afterEach(async () => {
		await client?.close();
		vi.clearAllMocks();
	});
	async function setup() {
		client = createPglite();
		const database = drizzle(client, { schema });
		mocks.database = database;
		mocks.repository = createRepositories(() => database, {
			info: mocks.info,
			error: mocks.error,
		}).job;
		await migrate(database, {
			migrationsFolder: path.resolve(
				process.cwd().endsWith("apps/server")
					? "drizzle"
					: "apps/server/drizzle",
			),
		});
		await database.insert(schema.mediaSources).values(
			[sourceId, otherSourceId].map((id) => ({
				id,
				name: id,
				type: "local" as const,
				connectionInfo: { path: "/tmp" },
			})),
		);
		await database.insert(schema.medias).values(
			ids.map((id, index) => ({
				id,
				mediaSourceId: index === 2 ? otherSourceId : sourceId,
				filePath: `${id}.${index === 1 ? "mp4" : "png"}`,
				fileName: `${id}.${index === 1 ? "mp4" : "png"}`,
				mediaType: index === 1 ? ("video" as const) : ("image" as const),
				width: 256,
				height: 256,
				modifiedAt,
			})),
		);
		const store = new PostgresEmbeddingStore(database);
		const record = (id: string, feature: number[]) => ({
			mediaId: id,
			vector: feature,
			model: EMBEDDING_GEMMA_MODEL,
			version: EMBEDDING_GEMMA_VERSION,
			mediaModifiedAt: modifiedAt,
		});
		return { database, store, record };
	}

	it("snapshots new embedding batches and lists individual targets", async () => {
		await setup();
		const batch = await queueEmbeddingBatch({
			mediaSourceId: sourceId,
			force: false,
		});
		expect(batch.total).toBe(2);
		const page = await listBatchTargets({ id: batch.id, offset: 1, limit: 1 });
		expect(page.total).toBe(2);
		expect(page.items).toHaveLength(1);
		expect(page.items[0]).toMatchObject({
			stage: "extract_embedding_vector",
			status: "pending",
		});
		expect(ids).toContain(page.items[0].mediaId);
	});

	it("claims DB-created jobs at an absolute stage cutoff in a non-UTC timezone", async () => {
		const { database } = await setup();
		await database.execute(sql`SET TIME ZONE 'Asia/Tokyo'`);
		await mocks.repository.create({ type: "auto_tagging", payload: {} });
		const opts = { includeTypes: ["auto_tagging"] };
		expect(
			await mocks.repository.claimPending(1, {
				...opts,
				createdBefore: new Date(Date.now() - 60000),
			}),
		).toHaveLength(0);
		expect(
			await mocks.repository.claimPending(1, {
				...opts,
				createdBefore: new Date(Date.now() + 1000),
			}),
		).toHaveLength(1);
	});
	it("cancels the pending embedding targets and waits for an already-running attempt", async () => {
		await setup();
		const repo: IJobRepository = mocks.repository;
		const batch = await queueEmbeddingBatch({
			mediaSourceId: sourceId,
			force: false,
		});
		const [running] = await repo.claimPending(1, {
			includeTypes: ["extract_embedding_vector"],
		});
		await repo.requestCancellation(batch.id);
		expect(await repo.isCancellationRequested(running.id)).toBe(true);
		expect(await repo.findById(batch.id)).toMatchObject({
			status: "in_progress",
			payload: { failed: 0, cancelled: 1, total: 2 },
		});
		await repo.finishAttempt(running.id, 1, {
			status: "completed",
			result: null,
		});
		expect(await repo.findById(batch.id)).toMatchObject({
			status: "cancelled",
			payload: { failed: 0, cancelled: 2, total: 2 },
		});
	});
	it("publishes the parent's cancellation when the final upload finishes after cancel", async () => {
		const { database } = await setup();
		const repo: IJobRepository = mocks.repository;
		const id = crypto.randomUUID();
		const batch = await database.transaction((tx) =>
			createImportBatch(tx, sourceId, [
				{ label: "upload.png", work: { type: "import_upload", id } },
			]),
		);
		await expect(
			runImportSubmission(sourceId, id, "import_upload", async () => {
				await repo.requestCancellation(batch.id);
				return { success: true };
			}),
		).rejects.toThrow("no longer active");
		expect((await repo.findById(batch.id))?.status).toBe("cancelled");
		expect(mocks.publishJob).toHaveBeenCalledWith(
			"job-cancelled",
			expect.objectContaining({ jobId: batch.id }),
		);
	});
	it("binds multiple download outputs once even when registration is replayed", async () => {
		const { database } = await setup();
		const repo: IJobRepository = mocks.repository;
		const group = await database.transaction((tx) =>
			createImportBatch(tx, sourceId, [
				{ label: "multi", work: { type: "downloadImage" } },
			]),
		);
		const [work] = await repo.claimPending(1, {
			includeTypes: ["downloadImage"],
		});
		const owner = importWorkOwner(work);
		assert.isDefined(owner);
		for (const mediaId of [ids[0], ids[1], ids[1]])
			await repo.createIfUnique(
				{ type: "processMedia", mediaSourceId: sourceId, payload: { mediaId } },
				owner,
			);
		await repo.finishAttempt(work.id, 1, { status: "completed", result: null });
		const prepare = await repo.claimPending(10, {
			includeTypes: ["processMedia"],
		});
		expect(prepare).toHaveLength(2);
		for (const job of prepare)
			await repo.finishAttempt(job.id, 1, {
				status: "completed",
				result: null,
			});
		expect(await repo.findById(group.id)).toMatchObject({
			status: "completed",
			payload: { processed: 2, total: 2 },
		});
	});
	it("fails an interrupted scan and settles abandoned reservations without double counting", async () => {
		const { database } = await setup();
		const repo: IJobRepository = mocks.repository;
		const scanId = crypto.randomUUID();
		await database.transaction((tx) =>
			createImportBatch(
				tx,
				sourceId,
				[{ label: "unfinished", work: { type: "import_register" } }],
				scanId,
			),
		);
		const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);
		expect(await repo.requeueStaleInProgress(cutoff)).toBe(1);
		expect(await repo.requeueStaleInProgress(cutoff)).toBe(0);
		expect(await repo.findById(scanId)).toMatchObject({
			status: "failed",
			payload: { total: 1, processed: 0, failed: 1, scanFailed: true },
		});
	});
	it("drains every preceding stage, accounts for failed targets once, and pages beyond 25", async () => {
		const { database } = await setup();
		const repo: IJobRepository = mocks.repository;
		const items = Array.from({ length: 27 }, (_, i) => ({
			label: String(i),
			skipped: i >= 2,
			work: { type: "processMedia", payload: { mediaId: ids[i % 3] } },
		}));
		const parent = await database.transaction((tx) =>
			createImportBatch(tx, sourceId, items),
		);
		const [a, b] = await repo.claimPending(2, {
			includeTypes: ["processMedia"],
		});
		for (const job of [a, b]) {
			const owner = importWorkOwner(job);
			assert.isDefined(owner);
			for (const type of [
				"auto_tagging",
				"extract_embedding_vector",
				"extract_ccip_vector",
			]) {
				await repo.createIfUnique(
					{ type, mediaSourceId: sourceId, payload: { mediaId: ids[0] } },
					owner,
				);
			}
		}
		// The turn began before these preparation jobs created all their tagging work.
		// A late member of the same batch must still run before switching models.
		await database
			.update(schema.jobs)
			.set({ createdAt: sql`now() + interval '1 hour'` })
			.where(eq(schema.jobs.type, "auto_tagging"));
		const done = { status: "completed" as const, result: null };
		await repo.finishAttempt(a.id, 1, done);
		expect(
			await repo.claimPending(3, { includeTypes: ["auto_tagging"] }),
		).toEqual([]);
		await repo.finishAttempt(b.id, 1, done);
		const tags = await repo.claimPending(3, {
			includeTypes: ["auto_tagging"],
			createdBefore: new Date(Date.now() + 1000),
		});
		expect(tags).toHaveLength(2);
		await repo.finishAttempt(tags[0].id, 1, {
			status: "failed",
			error: "tagger",
		});
		expect(
			await repo.claimPending(3, {
				includeTypes: ["extract_embedding_vector"],
			}),
		).toEqual([]);
		await repo.finishAttempt(tags[1].id, 1, done);
		for (const type of ["extract_embedding_vector", "extract_ccip_vector"]) {
			const stage = await repo.claimPending(3, { includeTypes: [type] });
			expect(stage).toHaveLength(2);
			for (const job of stage) await repo.finishAttempt(job.id, 1, done);
		}
		expect(await repo.findById(parent.id)).toMatchObject({
			status: "failed",
			payload: { total: 27, processed: 26, failed: 1 },
		});
		const retries = await Promise.all([
			repo.retryFailedBatch(parent.id),
			repo.retryFailedBatch(parent.id),
		]);
		expect(retries.filter(Boolean)).toHaveLength(1);
		expect(await repo.findById(parent.id)).toMatchObject({
			status: "in_progress",
			payload: { total: 27, processed: 26, failed: 0 },
		});
		const retried = await repo.claimPending(10, {
			includeTypes: [
				"auto_tagging",
				"processMedia",
				"extract_embedding_vector",
				"extract_ccip_vector",
			],
		});
		expect(
			retried.map(({ id, attemptCount }) => ({ id, attemptCount })),
		).toEqual([{ id: tags[0].id, attemptCount: 2 }]);
		expect(await repo.finishAttempt(tags[0].id, 1, done)).toBeNull();
		await repo.finishAttempt(tags[0].id, 2, done);
		expect(await repo.findById(parent.id)).toMatchObject({
			status: "completed",
			payload: { total: 27, processed: 27, failed: 0 },
		});
		expect(
			await listBatchTargets({ id: parent.id, offset: 25, limit: 25 }),
		).toMatchObject({
			total: 27,
			items: [expect.anything(), expect.anything()],
		});
	});
	it("cancels only the selected import, fences late work and leaves a concurrent single import runnable", async () => {
		const { database } = await setup();
		const repo: IJobRepository = mocks.repository;
		const id = crypto.randomUUID();
		const batch = await database.transaction((tx) =>
			createImportBatch(
				tx,
				sourceId,
				[
					{ label: "running", work: { type: "downloadImage" } },
					{ label: "failed", work: { type: "processMedia" } },
					{ label: "pending", work: { type: "import_upload" } },
					{ label: "done", skipped: true, work: { type: "processMedia" } },
				],
				id,
			),
		);
		const [running] = await repo.claimPending(1, {
			includeTypes: ["downloadImage"],
		});
		const [failed] = await repo.claimPending(1, {
			includeTypes: ["processMedia"],
		});
		await repo.finishAttempt(failed.id, 1, {
			status: "failed",
			error: "metadata unavailable",
		});
		const single = await repo.create({
			type: "downloadImage",
			mediaSourceId: sourceId,
			payload: {},
		});
		await repo.requestCancellation(batch.id);
		await repo.requestCancellation(batch.id);
		await expect(
			database.transaction((tx) =>
				createImportBatch(
					tx,
					sourceId,
					[{ label: "late", work: { type: "import_register" } }],
					id,
				),
			),
		).rejects.toThrow("scan is closed");
		const owner = importWorkOwner(running);
		if (!owner) throw new Error("Missing import owner");
		await expect(
			repo.createIfUnique(
				{ type: "processMedia", payload: { mediaId: ids[0] } },
				owner,
			),
		).rejects.toThrow("no longer active");
		expect(await repo.findById(id)).toMatchObject({
			status: "in_progress",
			payload: { processed: 1, failed: 1, cancelled: 1, total: 4 },
		});
		const [independent] = await repo.claimPending(1, {
			includeTypes: ["downloadImage"],
		});
		expect(independent).toMatchObject({
			id: single.id,
			cancelRequestedAt: null,
			parentId: null,
		});
		await repo.finishAttempt(running.id, 1, {
			status: "completed",
			result: null,
		});
		expect(await repo.findById(id)).toMatchObject({
			status: "cancelled",
			payload: { processed: 1, failed: 1, cancelled: 2, total: 4 },
		});
		expect(
			await repo.finishAttempt(single.id, 1, {
				status: "completed",
				result: null,
			}),
		).toBe("completed");
		expect(await repo.retryFailedBatch(id)).toMatchObject({
			status: "in_progress",
			cancelRequestedAt: null,
		});
		const retries = await repo.claimPending(10);
		expect(retries.map((job) => job.id)).toEqual([failed.id]);
		await repo.finishAttempt(failed.id, 2, {
			status: "completed",
			result: null,
		});
		expect(await repo.findById(id)).toMatchObject({
			status: "cancelled",
			payload: { processed: 2, failed: 0, cancelled: 2, total: 4 },
		});
		expect(await repo.retryFailedBatch(id)).toBeNull();
	});
	it("does not run cancelled or replaced job attempts, and validates extraction payloads", async () => {
		await setup();
		const job = await mocks.repository.create({
			type: "extract_embedding_batch",
			status: "in_progress",
			payload: {},
		});
		await mocks.repository.requestCancellation(job.id);
		await processEmbeddingBatchJob(job);
		expect(mocks.extract).not.toHaveBeenCalled();
		await mocks.repository.update(job.id, {
			attemptCount: 1,
			cancelRequestedAt: null,
		});
		await processEmbeddingBatchJob(job);
		expect(mocks.extract).not.toHaveBeenCalled();
		await expect(
			processEmbeddingBatchJob({ ...job, payload: { cursor: "invalid-id" } }),
		).rejects.toThrow();
	});
	it("retrieves active, current visual neighbors across sources without the anchor", async () => {
		const { database, store, record } = await setup();
		await store.upsert(record(ids[0], vector(1)));
		await store.upsert(record(ids[1], vector(0, 1)));
		await store.upsert(record(ids[2], vector(0.9, 0.1)));
		const neighbors = () => store.nearestRelated(vector(1), ids[0], 96);
		expect((await neighbors()).map((row) => row.mediaId)).toEqual([
			ids[2],
			ids[1],
		]);
		await database
			.update(schema.medias)
			.set({ status: "archived" })
			.where(eq(schema.medias.id, ids[2]));
		await database
			.update(schema.medias)
			.set({ modifiedAt: new Date("2026-02-01") })
			.where(eq(schema.medias.id, ids[1]));
		expect(await neighbors()).toEqual([]);
	});

	it("orders image and video vectors, pages, filters source and stale vectors, and cascades deletion", async () => {
		const { database, store, record } = await setup();
		await store.upsert(record(ids[0], vector(1)));
		await store.upsert(record(ids[1], vector(0, 1)));
		await store.upsert(record(ids[2], vector(0.9, 0.1)));
		await database
			.update(schema.medias)
			.set({ modifiedAt: sql`'2026-01-01 00:00:00.000123'::timestamp` })
			.where(eq(schema.medias.id, ids[0]));
		expect(
			await countEmbeddingTargets({ mediaSourceId: sourceId, force: false }),
		).toBe(0);
		expect(
			(await store.search(vector(1), { limit: 2, offset: 0 })).candidates.map(
				(item) => item.mediaId,
			),
		).toEqual([ids[0], ids[2]]);
		expect(
			(await store.search(vector(1), { limit: 2, offset: 2 })).candidates.map(
				(item) => item.mediaId,
			),
		).toEqual([ids[1]]);
		expect(
			(
				await store.search(vector(1), {
					mediaSourceId: sourceId,
					excludeMediaId: ids[0],
					limit: 20,
					offset: 0,
				})
			).candidates.map((item) => item.mediaId),
		).toEqual([ids[1]]);
		await database
			.update(schema.medias)
			.set({ modifiedAt: new Date("2026-02-01") })
			.where(eq(schema.medias.id, ids[1]));
		expect(
			(await store.search(vector(1), { limit: 20, offset: 0 })).total,
		).toBe(2);
		expect(await countEmbeddingTargets({ force: false })).toBe(1);
		await database.delete(schema.medias).where(eq(schema.medias.id, ids[0]));
		expect(await store.get(ids[0])).toBeNull();
		await expect(store.upsert(record(ids[1], vector(0)))).rejects.toThrow();
	});

	it("runs a scoped batch and retries failed videos without losing its AI job payload", async () => {
		const { store, record } = await setup();
		mocks.extract.mockImplementation(async (_source: string, id: string) => {
			if (id === ids[1]) throw new Error("Inference unavailable");
			await store.upsert(record(id, vector(1)));
		});
		const job = await mocks.repository.create({
			type: "extract_embedding_batch",
			mediaSourceId: sourceId,
			status: "in_progress",
			payload: { mediaSourceId: sourceId },
		});
		await expect(processEmbeddingBatchJob(job)).rejects.toThrow(
			"1 EmbeddingGemma",
		);
		expect(mocks.info).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: job.id,
				processed: 0,
				failed: 0,
				total: 2,
			}),
			"EmbeddingGemma 2 batch started",
		);
		expect(mocks.info).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: job.id,
				mediaId: ids[0],
				processed: 1,
				failed: 0,
				total: 2,
				durationMs: expect.any(Number),
			}),
			"EmbeddingGemma 2 batch progress",
		);
		expect(mocks.info).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: job.id,
				mediaId: ids[1],
				processed: 1,
				failed: 1,
				total: 2,
			}),
			"EmbeddingGemma 2 batch progress",
		);
		expect(mocks.error).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: job.id,
				processed: 1,
				failed: 1,
				total: 2,
			}),
			"EmbeddingGemma 2 batch failed",
		);
		expect(
			await countEmbeddingTargets({ mediaSourceId: sourceId, force: false }),
		).toBe(1);
		mocks.extract.mockImplementation(async (_source: string, id: string) =>
			store.upsert(record(id, vector(1))),
		);
		const retry = await mocks.repository.findById(job.id);
		await processEmbeddingBatchJob(retry);
		expect(mocks.info).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: job.id,
				processed: 1,
				failed: 0,
				total: 1,
				durationMs: expect.any(Number),
			}),
			"EmbeddingGemma 2 indexing completed",
		);
		expect(
			await countEmbeddingTargets({ mediaSourceId: sourceId, force: false }),
		).toBe(0);
		expect(await countEmbeddingTargets({ force: false })).toBe(1);
		expect(mocks.publishJob).toHaveBeenCalledWith(
			"job-progress",
			expect.objectContaining({ jobId: job.id, processed: 1, total: 1 }),
		);
	});
	it("includes active videos and filters archived media before applying the recommendation limit", async () => {
		const { database, store, record } = await setup();
		await store.upsert(record(ids[0], vector(1)));
		await store.upsert(record(ids[1], vector(0.99, 0.01)));
		await store.upsert(record(ids[2], vector(0.9, 0.1)));
		await database
			.update(schema.medias)
			.set({ status: "archived" })
			.where(eq(schema.medias.id, ids[0]));
		const result = await store.search(vector(1), {
			activeOnly: true,
			limit: 1,
			offset: 0,
		});
		expect(result.candidates.map((item) => item.mediaId)).toEqual([ids[1]]);
		expect(result.total).toBe(2);
	});

	it("indexes local images and videos while excluding audio and remote sources", async () => {
		const { database, store, record } = await setup();
		const audioId = "66666666-6666-4666-8666-666666666666";
		await database.insert(schema.medias).values({
			id: audioId,
			mediaSourceId: sourceId,
			filePath: "audio.mp3",
			fileName: "audio.mp3",
			mediaType: "audio",
			width: 0,
			height: 0,
			modifiedAt,
		});
		await database
			.update(schema.mediaSources)
			.set({ type: "s3" })
			.where(eq(schema.mediaSources.id, otherSourceId));
		expect(await countEmbeddingTargets({ force: false })).toBe(2);
		expect(await countEmbeddingTargets({ force: true })).toBe(2);

		await store.upsert(record(ids[0], vector(1)));
		await store.upsert(record(ids[1], vector(0.9, 0.1)));
		// Even an accidentally stored audio vector must not enter visual search.
		await store.upsert(record(audioId, vector(1)));
		expect(
			(await store.search(vector(1), { limit: 20, offset: 0 })).candidates.map(
				(item) => item.mediaId,
			),
		).toEqual([ids[0], ids[1]]);
		expect(await countEmbeddingTargets({ force: false })).toBe(0);
		expect(await countEmbeddingTargets({ force: true })).toBe(2);
	});
	it("logs single-image start, completion and failures with job and media context", async () => {
		await setup();
		mocks.extract.mockResolvedValue(undefined);
		const job = await mocks.repository.create({
			type: "extract_embedding_vector",
			mediaSourceId: sourceId,
			payload: { mediaId: ids[0] },
		});
		await processEmbeddingExtractionJob(job);
		expect(mocks.info).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: job.id,
				mediaSourceId: sourceId,
				mediaId: ids[0],
			}),
			"EmbeddingGemma 2 extraction started",
		);
		expect(mocks.info).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: job.id,
				mediaId: ids[0],
				durationMs: expect.any(Number),
			}),
			"EmbeddingGemma 2 extraction completed",
		);
		const error = new Error("inference unavailable");
		mocks.extract.mockRejectedValueOnce(error);
		await expect(processEmbeddingExtractionJob(job)).rejects.toBe(error);
		expect(mocks.error).toHaveBeenCalledWith(
			expect.objectContaining({ jobId: job.id, mediaId: ids[0], err: error }),
			"EmbeddingGemma 2 extraction failed",
		);
	});
});
