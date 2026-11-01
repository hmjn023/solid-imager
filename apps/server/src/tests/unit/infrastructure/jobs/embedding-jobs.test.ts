import path from "node:path";
import {
	EMBEDDING_GEMMA_MODEL,
	EMBEDDING_GEMMA_VERSION,
} from "@solid-imager/core/domain/search/embedding";
import { createJobRepository } from "@solid-imager/db/repositories/job-repository";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
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
		mocks.repository = createJobRepository(() => database);
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
				filePath: `${id}.png`,
				fileName: `${id}.png`,
				mediaType: "image" as const,
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
	it("orders, pages, filters source and stale vectors, and cascades deletion", async () => {
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

	it("runs a scoped batch and retries failed images without losing its AI job payload", async () => {
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
