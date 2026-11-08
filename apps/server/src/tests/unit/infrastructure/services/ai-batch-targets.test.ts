import { randomUUID } from "node:crypto";
import path from "node:path";
import {
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
} from "@solid-imager/application/ccip";
import { createRepositories } from "@solid-imager/db";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { PostgresCcipVectorStore } from "~/infrastructure/ai/postgres-ccip-vector-store";
import { createPglite } from "~/infrastructure/db/pglite";
import * as schema from "~/infrastructure/db/schema";
import {
	countCcipTargets,
	countTaggingTargets,
} from "~/infrastructure/services/ai-batch-targets";

const mocks = vi.hoisted(() => ({
	database: undefined as any,
	repository: undefined as any,
	getMetadataMany: vi.fn(),
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
vi.mock("~/infrastructure/services/ccip-vector-service", () => ({
	ccipVectorService: { getMetadataMany: mocks.getMetadataMany },
}));
vi.mock("~/infrastructure/services/tagging-service", () => ({
	taggingService: {},
}));
vi.mock("~/infrastructure/events/realtime-event-bus", () => ({
	RealtimeEventBus: { publishJob: mocks.publishJob },
}));
vi.mock("~/infrastructure/logger", () => ({
	logger: { info: mocks.info, error: mocks.error },
}));
import { processBulkTaggingDispatchJob } from "~/infrastructure/jobs/tagging-jobs";
import { processBatchCcipDispatchJob } from "~/infrastructure/jobs/ccip-jobs";

describe("AI batch target counts", () => {
	const client = createPglite();
	const database = drizzle(client, { schema });
	const repository = createRepositories(() => database, {
		info: mocks.info,
		error: mocks.error,
	}).job;
	mocks.database = database;
	mocks.repository = repository;
	const modifiedAt = new Date("2026-01-01T00:00:00.123Z");
	beforeAll(async () => {
		await migrate(database, {
			migrationsFolder: path.resolve(
				process.cwd().endsWith("apps/server")
					? "drizzle"
					: "apps/server/drizzle",
			),
		});
	});
	afterEach(async () => {
		await database.delete(schema.mediaSources);
		await database.delete(schema.jobs);
		vi.clearAllMocks();
	});
	afterAll(async () => client.close());

	async function source(type: "local" | "s3" = "local") {
		const id = randomUUID();
		await database.insert(schema.mediaSources).values({
			id,
			name: id,
			type,
			connectionInfo: { path: "/tmp" },
		});
		return id;
	}
	async function media(
		mediaSourceId: string,
		mediaType: "image" | "video" | "audio" = "image",
	) {
		const id = randomUUID();
		await database.insert(schema.medias).values({
			id,
			mediaSourceId,
			mediaType,
			fileName: id,
			filePath: id,
			width: 256,
			height: 256,
			modifiedAt,
		});
		return id;
	}

	it("counts local images and videos, preserving AI/manual and any-category semantics", async () => {
		const local = await source();
		const remote = await source("s3");
		await media(local); // untagged
		const manual = await media(local);
		const tagged = await media(local, "video");
		const character = await media(local);
		const ip = await media(local);
		await media(local, "video");
		await media(local, "audio");
		await media(remote);
		await media(remote, "video");
		const tagIds = [randomUUID(), randomUUID()];
		await database
			.insert(schema.tags)
			.values(tagIds.map((id) => ({ id, name: id })));
		await database
			.insert(schema.mediaTags)
			.values([
				{ mediaId: manual, tagId: tagIds[0], source: "manual" },
				...tagIds.map((tagId) => ({ mediaId: tagged, tagId, source: "AI" })),
			]);
		const characterId = randomUUID();
		await database
			.insert(schema.characters)
			.values({ id: characterId, name: characterId });
		await database
			.insert(schema.mediaCharacters)
			.values({ mediaId: character, characterId, source: "AI" });
		const ipId = randomUUID();
		await database.insert(schema.ips).values({ id: ipId, name: ipId });
		await database
			.insert(schema.mediaIps)
			.values({ mediaId: ip, ipId, source: "AI" });
		expect(await countTaggingTargets(database, {})).toBe(3);
		expect(await countTaggingTargets(database, { mediaSourceId: local })).toBe(
			3,
		);
		expect(
			await countTaggingTargets(database, {
				mediaSourceId: local,
				force: true,
			}),
		).toBe(6);
		expect(await countTaggingTargets(database, { force: true })).toBe(6);
		expect(
			await countTaggingTargets(database, { mediaSourceId: randomUUID() }),
		).toBe(0);
	});

	it("counts missing/stale image and video CCIP vectors without loading vector data", async () => {
		const local = await source();
		const other = await source();
		await media(local); // missing
		await media(other);
		await media(local, "video");
		await media(local, "audio");
		await media(await source("s3"));
		await media(await source("s3"), "video");
		for (const state of [
			"current",
			"stale",
			"model",
			"version",
			"crop",
			"precision",
		]) {
			const mediaId = await media(
				local,
				state === "current" || state === "stale" ? "video" : "image",
			);
			const regionId = randomUUID();
			await database.insert(schema.mediaRegions).values({
				id: regionId,
				mediaId,
				kind: state === "crop" ? "person" : "full",
				sourceModifiedAt: modifiedAt,
				...(state === "crop" ? { x: 0, y: 0, width: 0.5, height: 0.5 } : {}),
			});
			await database.insert(schema.ccipEmbeddings).values({
				regionId,
				embedding: Array.from({ length: 768 }, () => 0),
				model: state === "model" ? "old-model" : CCIP_MODEL,
				embeddingVersion:
					state === "version"
						? CCIP_EMBEDDING_VERSION + 1
						: CCIP_EMBEDDING_VERSION,
				mediaModifiedAt:
					state === "stale" ? new Date(modifiedAt.getTime() - 1) : modifiedAt,
				extractedAt: modifiedAt,
			});
			if (state === "precision") {
				await database
					.update(schema.medias)
					.set({ modifiedAt: sql`'2026-01-01 00:00:00.123456'::timestamp` })
					.where(eq(schema.medias.id, mediaId));
				await database
					.update(schema.ccipEmbeddings)
					.set({
						mediaModifiedAt: sql`'2026-01-01 00:00:00.123789'::timestamp`,
					})
					.where(eq(schema.ccipEmbeddings.regionId, regionId));
			}
		}
		expect(await countCcipTargets(database, { mediaSourceId: local })).toBe(6);
		expect(await countCcipTargets(database, {})).toBe(7);
		expect(
			await countCcipTargets(database, { mediaSourceId: local, force: true }),
		).toBe(8);
		expect(await countCcipTargets(database, { force: true })).toBe(9);
		expect(
			await countCcipTargets(database, { mediaSourceId: randomUUID() }),
		).toBe(0);
	});

	it("dispatches untagged local video jobs with matching counts, force and retry deduplication", async () => {
		const local = await source();
		const image = await media(local);
		const video = await media(local, "video");
		const tagged = await media(local, "video");
		await media(local, "audio");
		await media(await source("s3"), "video");
		await media(await source(), "video");
		const tagId = randomUUID();
		await database.insert(schema.tags).values({ id: tagId, name: tagId });
		await database
			.insert(schema.mediaTags)
			.values({ mediaId: tagged, tagId, source: "AI" });

		for (const force of [false, true]) {
			const expected = force ? [image, video, tagged] : [image, video];
			expect(
				await countTaggingTargets(database, { mediaSourceId: local, force }),
			).toBe(expected.length);
			const parent = await repository.create({
				type: "bulk_tagging_parent",
				status: "in_progress",
				payload: { total: expected.length, processed: 0, failed: 0 },
			});
			const dispatch = await repository.create({
				type: "bulk_tagging_dispatch",
				parentId: parent.id,
				payload: { mediaSourceId: local, force, batchSize: 1 },
			});
			await processBulkTaggingDispatchJob(dispatch);
			await processBulkTaggingDispatchJob(dispatch);
			const children = await database
				.select()
				.from(schema.jobs)
				.where(eq(schema.jobs.parentId, parent.id));
			const targets = children.filter((child) => child.type === "auto_tagging");
			expect(
				targets
					.map((child) => child.payload)
					.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
			).toEqual(expected.sort().map((mediaId) => ({ mediaId, force })));
			expect(targets.every((child) => child.mediaSourceId === local)).toBe(
				true,
			);
		}
	});

	it("dispatches missing/stale video vectors with matching counts and skips current videos unless forced", async () => {
		const local = await source();
		const image = await media(local);
		const video = await media(local, "video");
		const current = await media(local, "video");
		await media(local, "audio");
		await media(await source("s3"), "video");
		await media(await source(), "video");
		const store = new PostgresCcipVectorStore(database);
		await store.upsert({
			mediaId: current,
			mediaSourceId: local,
			vector: Array.from({ length: 768 }, (_, index) => (index === 0 ? 1 : 0)),
			model: CCIP_MODEL,
			embeddingVersion: CCIP_EMBEDDING_VERSION,
			mediaModifiedAt: modifiedAt,
			extractedAt: modifiedAt,
		});
		mocks.getMetadataMany.mockImplementation((mediaIds: string[]) =>
			store.getMetadataMany(mediaIds, {
				model: CCIP_MODEL,
				embeddingVersion: CCIP_EMBEDDING_VERSION,
			}),
		);
		for (const force of [false, true]) {
			const expected = force ? [image, video, current] : [image, video];
			expect(
				await countCcipTargets(database, { mediaSourceId: local, force }),
			).toBe(expected.length);
			const parent = await repository.create({
				type: "batch_ccip_parent",
				status: "in_progress",
				payload: { total: expected.length, processed: 0, failed: 0 },
			});
			const dispatch = await repository.create({
				type: "batch_ccip_dispatch",
				parentId: parent.id,
				payload: { mediaSourceId: local, force, batchSize: 1 },
			});
			await processBatchCcipDispatchJob(dispatch);
			await processBatchCcipDispatchJob(dispatch);
			const children = await database
				.select()
				.from(schema.jobs)
				.where(eq(schema.jobs.parentId, parent.id));
			const targets = children.filter(
				(child) => child.type === "extract_ccip_vector",
			);
			expect(
				targets
					.map((child) => child.payload)
					.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
			).toEqual(
				expected.sort().map((mediaId) => ({ mediaIds: [mediaId], force })),
			);
			expect(targets.every((child) => child.mediaSourceId === local)).toBe(
				true,
			);
		}
	});
});
