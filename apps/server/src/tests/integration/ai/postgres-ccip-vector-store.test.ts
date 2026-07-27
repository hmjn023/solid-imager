import path from "node:path";
import type { CcipVectorRecord } from "@solid-imager/application/ports/ccip-vector-store";
import {
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
	CCIP_PREPROCESSING_PROFILE,
} from "@solid-imager/application/services/ccip-vector-service";
import {
	createCcipEmbeddingInputRevision,
	createMediaSourceRevision,
} from "@solid-imager/core/domain/media/revision";
import {
	CCIP_VECTOR_DIMENSIONS,
	mediaRegions,
	mediaSources,
	medias,
} from "@solid-imager/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, it } from "vite-plus/test";
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

const sourceARevision = await createMediaSourceRevision({
	mediaId: ANCHOR_MEDIA_ID,
	mediaSourceId: SOURCE_A_ID,
	modifiedAt: MODIFIED_AT,
	fileSize: null,
	width: 256,
	height: 256,
});
const sourceAInputRevision = await createCcipEmbeddingInputRevision({
	sourceRevision: sourceARevision,
	model: CCIP_MODEL,
	embeddingVersion: CCIP_EMBEDDING_VERSION,
	preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
});

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
		regionId: null,
		regionKind: "full",
		mediaId,
		mediaSourceId,
		vector: feature,
		model: CCIP_MODEL,
		embeddingVersion: CCIP_EMBEDDING_VERSION,
		mediaModifiedAt: MODIFIED_AT,
		inputRevision:
			mediaId === ANCHOR_MEDIA_ID
				? sourceAInputRevision
				: "set-by-test-before-write",
		preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
		extractedAt: EXTRACTED_AT,
	};
}

async function currentRecord(
	mediaId: string,
	mediaSourceId: string,
	feature: number[],
): Promise<CcipVectorRecord> {
	return {
		...record(mediaId, mediaSourceId, feature),
		inputRevision: await createCcipEmbeddingInputRevision({
			sourceRevision: await createMediaSourceRevision({
				mediaId,
				mediaSourceId,
				modifiedAt: MODIFIED_AT,
				fileSize: null,
				width: 256,
				height: 256,
			}),
			model: CCIP_MODEL,
			embeddingVersion: CCIP_EMBEDDING_VERSION,
			preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
		}),
	};
}

describe("PostgresCcipVectorStore", () => {
	let client: ReturnType<typeof createPglite> | undefined;

	afterEach(async () => {
		await client?.close();
		client = undefined;
	});

	it("persists and searches CCIP vectors with pgvector without LanceDB", async () => {
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

		const store = new PostgresCcipVectorStore(database);
		const anchor = record(ANCHOR_MEDIA_ID, SOURCE_A_ID, vector(1));
		const legacyAnchor = {
			...record(ANCHOR_MEDIA_ID, SOURCE_A_ID, vector(0, 1)),
			model: "ccip-legacy-model",
			embeddingVersion: 2,
			inputRevision: await createCcipEmbeddingInputRevision({
				sourceRevision: sourceARevision,
				model: "ccip-legacy-model",
				embeddingVersion: 2,
				preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
			}),
		};
		const records = await Promise.all([
			currentRecord(NEAR_MEDIA_ID, SOURCE_A_ID, vector(0.875, 0.125)),
			currentRecord(FAR_MEDIA_ID, SOURCE_A_ID, vector(0, 1)),
			currentRecord(
				OTHER_SOURCE_MEDIA_ID,
				SOURCE_B_ID,
				vector(0.75, 0.25),
			),
		]);
		await store.upsertMany([
			anchor,
			legacyAnchor,
			...records,
		]);

		const storedAnchor = await store.get(ANCHOR_MEDIA_ID, {
				model: CCIP_MODEL,
				embeddingVersion: CCIP_EMBEDDING_VERSION,
				preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
			});
		expect(storedAnchor).toEqual({
			...anchor,
			regionId: expect.any(String),
		});
		const metadata = await store.getMetadataMany([ANCHOR_MEDIA_ID], {
				model: CCIP_MODEL,
				embeddingVersion: CCIP_EMBEDDING_VERSION,
				preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
			});
		const { vector: omittedVector, ...anchorMetadata } = anchor;
		void omittedVector;
		expect(metadata.get(ANCHOR_MEDIA_ID)).toEqual({
			...anchorMetadata,
			regionId: expect.any(String),
		});

		const candidates = await store.search(anchor.vector, 10, {
			mediaSourceId: SOURCE_A_ID,
			model: CCIP_MODEL,
			embeddingVersion: CCIP_EMBEDDING_VERSION,
			preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
		});
		expect(candidates.map((candidate) => candidate.mediaId)).toEqual([
			ANCHOR_MEDIA_ID,
			NEAR_MEDIA_ID,
			FAR_MEDIA_ID,
		]);
		expect(candidates.map((candidate) => candidate.mediaId)).not.toContain(
			OTHER_SOURCE_MEDIA_ID,
		);

		await database
			.update(medias)
			.set({ modifiedAt: NEWER_MODIFIED_AT })
			.where(eq(medias.id, ANCHOR_MEDIA_ID));
		const newerAnchor = {
			...anchor,
			vector: vector(0.5, 0.5),
			mediaModifiedAt: NEWER_MODIFIED_AT,
			inputRevision: await createCcipEmbeddingInputRevision({
				sourceRevision: await createMediaSourceRevision({
					mediaId: ANCHOR_MEDIA_ID,
					mediaSourceId: SOURCE_A_ID,
					modifiedAt: NEWER_MODIFIED_AT,
					fileSize: null,
					width: 256,
					height: 256,
				}),
				model: CCIP_MODEL,
				embeddingVersion: CCIP_EMBEDDING_VERSION,
				preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
			}),
			extractedAt: NEWER_EXTRACTED_AT,
		};
		await store.upsert(newerAnchor);
		await expect(store.upsert(anchor)).rejects.toThrow(
			"CCIP input revision changed before commit",
		);
		expect(
			await store.get(ANCHOR_MEDIA_ID, {
				model: CCIP_MODEL,
				embeddingVersion: CCIP_EMBEDDING_VERSION,
				preprocessingProfile: CCIP_PREPROCESSING_PROFILE,
			}),
		).toEqual({ ...newerAnchor, regionId: expect.any(String) });
		const [region] = await database
			.select({ sourceModifiedAt: mediaRegions.sourceModifiedAt })
			.from(mediaRegions)
			.where(eq(mediaRegions.mediaId, ANCHOR_MEDIA_ID));
		expect(region?.sourceModifiedAt).toEqual(NEWER_MODIFIED_AT);
	});
});
