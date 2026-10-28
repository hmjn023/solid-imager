import path from "node:path";
import type { CcipVectorRecord } from "@solid-imager/application/ports/ccip-vector-store";
import {
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
} from "@solid-imager/application/services/ccip-vector-service";
import {
	CCIP_VECTOR_DIMENSIONS,
	mediaRegions,
	mediaSources,
	medias,
} from "@solid-imager/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PostgresCcipVectorStore } from "~/infrastructure/ai/postgres-ccip-vector-store";
import { createPglite } from "~/infrastructure/db/pglite";
import * as schema from "~/infrastructure/db/schema";

const SOURCE_A_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_B_ID = "22222222-2222-4222-8222-222222222222";
const ANCHOR_MEDIA_ID = "33333333-3333-4333-8333-333333333333";
const NEAR_MEDIA_ID = "44444444-4444-4444-8444-444444444444";
const FAR_MEDIA_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_SOURCE_MEDIA_ID = "66666666-6666-4666-8666-666666666666";

const MODIFIED_AT = new Date("2026-07-01T00:00:00.000Z");
const EXTRACTED_AT = new Date("2026-07-02T00:00:00.000Z");
const NEWER_MODIFIED_AT = new Date("2026-07-03T00:00:00.000Z");
const NEWER_EXTRACTED_AT = new Date("2026-07-04T00:00:00.000Z");

function vector(first: number, second = 0): number[] {
	return Array.from({ length: CCIP_VECTOR_DIMENSIONS }, (_, index) => {
		if (index === 0) return first;
		if (index === 1) return second;
		return 0;
	});
}

function record(
	mediaId: string,
	mediaSourceId: string,
	feature: number[],
): CcipVectorRecord {
	return {
		mediaId,
		mediaSourceId,
		vector: feature,
		model: CCIP_MODEL,
		embeddingVersion: CCIP_EMBEDDING_VERSION,
		mediaModifiedAt: MODIFIED_AT,
		extractedAt: EXTRACTED_AT,
	};
}

describe("PostgresCcipVectorStore", () => {
	let client: ReturnType<typeof createPglite> | undefined;

	afterEach(async () => {
		await client?.close();
		client = undefined;
	});

	it("persists and searches CCIP vectors with pgvector", async () => {
		client = createPglite();
		const database = drizzle(client, { schema });
		const migrationsFolder = process.cwd().endsWith("apps/server")
			? path.resolve(process.cwd(), "drizzle")
			: path.resolve(process.cwd(), "apps/server/drizzle");
		await migrate(database, { migrationsFolder });

		await database.insert(mediaSources).values([
			{
				id: SOURCE_A_ID,
				name: "Source A",
				description: null,
				type: "local",
				connectionInfo: { path: "/tmp/source-a" },
			},
			{
				id: SOURCE_B_ID,
				name: "Source B",
				description: null,
				type: "local",
				connectionInfo: { path: "/tmp/source-b" },
			},
		]);
		await database.insert(medias).values(
			[ANCHOR_MEDIA_ID, NEAR_MEDIA_ID, FAR_MEDIA_ID, OTHER_SOURCE_MEDIA_ID].map(
				(id) => ({
					id,
					mediaSourceId:
						id === OTHER_SOURCE_MEDIA_ID ? SOURCE_B_ID : SOURCE_A_ID,
					filePath: `${id}.png`,
					fileName: `${id}.png`,
					mediaType: "image" as const,
					width: 256,
					height: 256,
					modifiedAt: MODIFIED_AT,
				}),
			),
		);

		const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
		const store = new PostgresCcipVectorStore(database, logger);
		const anchor = record(ANCHOR_MEDIA_ID, SOURCE_A_ID, vector(1));
		await store.upsertMany([
			anchor,
			{
				...record(ANCHOR_MEDIA_ID, SOURCE_A_ID, vector(0, 1)),
				model: "ccip-legacy-model",
				embeddingVersion: 2,
			},
			record(NEAR_MEDIA_ID, SOURCE_A_ID, vector(0.875, 0.125)),
			record(FAR_MEDIA_ID, SOURCE_A_ID, vector(0, 1)),
			record(OTHER_SOURCE_MEDIA_ID, SOURCE_B_ID, vector(0.75, 0.25)),
		]);

		expect(
			await store.get(ANCHOR_MEDIA_ID, {
				model: CCIP_MODEL,
				embeddingVersion: CCIP_EMBEDDING_VERSION,
			}),
		).toEqual(anchor);
		expect(
			await store.getMetadataMany([ANCHOR_MEDIA_ID], {
				model: CCIP_MODEL,
				embeddingVersion: CCIP_EMBEDDING_VERSION,
			}),
		).toEqual(
			new Map([
				[
					ANCHOR_MEDIA_ID,
					{
						mediaId: ANCHOR_MEDIA_ID,
						mediaSourceId: SOURCE_A_ID,
						model: CCIP_MODEL,
						embeddingVersion: CCIP_EMBEDDING_VERSION,
						mediaModifiedAt: MODIFIED_AT,
						extractedAt: EXTRACTED_AT,
					},
				],
			]),
		);

		const query = {
			mediaSourceId: SOURCE_A_ID,
			model: CCIP_MODEL,
			embeddingVersion: CCIP_EMBEDDING_VERSION,
		};
		const first = await store.search(
			anchor.vector,
			1,
			query,
			0,
			ANCHOR_MEDIA_ID,
		);
		const second = await store.search(
			anchor.vector,
			1,
			query,
			1,
			ANCHOR_MEDIA_ID,
		);
		expect(first.total).toBe(2);
		expect(second.total).toBe(2);
		expect(logger.info).toHaveBeenCalledWith(
			expect.objectContaining({ offset: 1, total: 2, candidateCount: 1 }),
			"CCIP pgvector candidate search completed",
		);
		expect(first.candidates.map((candidate) => candidate.mediaId)).toEqual([
			NEAR_MEDIA_ID,
		]);
		expect(second.candidates.map((candidate) => candidate.mediaId)).toEqual([
			FAR_MEDIA_ID,
		]);
		await store.upsert({
			...record(FAR_MEDIA_ID, SOURCE_A_ID, vector(0.875, 0.125)),
			extractedAt: NEWER_EXTRACTED_AT,
		});
		const tiedFirst = await store.search(
			anchor.vector,
			1,
			query,
			0,
			ANCHOR_MEDIA_ID,
		);
		const tiedSecond = await store.search(
			anchor.vector,
			1,
			query,
			1,
			ANCHOR_MEDIA_ID,
		);
		expect(tiedFirst.candidates[0]?.mediaId).toBe(NEAR_MEDIA_ID);
		expect(tiedSecond.candidates[0]?.mediaId).toBe(FAR_MEDIA_ID);
		await database
			.update(medias)
			.set({ modifiedAt: NEWER_MODIFIED_AT })
			.where(eq(medias.id, NEAR_MEDIA_ID));
		const current = await store.search(
			anchor.vector,
			10,
			query,
			0,
			ANCHOR_MEDIA_ID,
		);
		expect(current.total).toBe(1);
		expect(current.candidates.map((candidate) => candidate.mediaId)).toEqual([
			FAR_MEDIA_ID,
		]);

		const newerAnchor = {
			...anchor,
			vector: vector(0.5, 0.5),
			mediaModifiedAt: NEWER_MODIFIED_AT,
			extractedAt: NEWER_EXTRACTED_AT,
		};
		await store.upsert(newerAnchor);
		await store.upsert(anchor);
		expect(
			await store.get(ANCHOR_MEDIA_ID, {
				model: CCIP_MODEL,
				embeddingVersion: CCIP_EMBEDDING_VERSION,
			}),
		).toEqual(newerAnchor);
		const [region] = await database
			.select({ sourceModifiedAt: mediaRegions.sourceModifiedAt })
			.from(mediaRegions)
			.where(eq(mediaRegions.mediaId, ANCHOR_MEDIA_ID));
		expect(region?.sourceModifiedAt).toEqual(NEWER_MODIFIED_AT);
	}, 30_000);
});
