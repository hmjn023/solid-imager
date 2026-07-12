import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CcipVectorRecord } from "@solid-imager/application/ports/ccip-vector-store";
import type { ITaggingService } from "@solid-imager/application/ports/tagging-service";
import {
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
	CcipVectorService,
} from "@solid-imager/application/services/ccip-vector-service";
import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type {
	MediaSource,
	SourceRepository,
} from "@solid-imager/core/domain/repositories/source-repository";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { LanceDbCcipVectorStore } from "~/infrastructure/ai/lancedb-ccip-vector-store";

const SOURCE_A_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_B_ID = "22222222-2222-4222-8222-222222222222";
const ANCHOR_MEDIA_ID = "33333333-3333-4333-8333-333333333333";
const NEAR_MEDIA_ID = "44444444-4444-4444-8444-444444444444";
const FAR_MEDIA_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_SOURCE_MEDIA_ID = "66666666-6666-4666-8666-666666666666";

const MODIFIED_AT = new Date("2026-07-01T00:00:00.000Z");
const EXTRACTED_AT = new Date("2026-07-02T00:00:00.000Z");

function vector(first: number, second = 0): number[] {
	return Array.from({ length: 768 }, (_, index) => {
		if (index === 0) return first;
		if (index === 1) return second;
		return 0;
	});
}

function createMedia(id: string, mediaSourceId: string): Media {
	return {
		id,
		mediaSourceId,
		filePath: `${id}.png`,
		fileName: `${id}.png`,
		mediaType: "image",
		width: 256,
		height: 256,
		fileSize: 1,
		description: null,
		createdAt: MODIFIED_AT,
		modifiedAt: MODIFIED_AT,
		indexedAt: MODIFIED_AT,
		status: "active",
	};
}

function createSource(id: string): MediaSource {
	return {
		id,
		name: `LanceDB integration source ${id}`,
		description: null,
		type: "local",
		connectionInfo: { path: "/tmp" },
		createdAt: MODIFIED_AT,
		updatedAt: MODIFIED_AT,
	};
}

function createRecord(
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

function createTaggingService(): ITaggingService {
	const unsupported = async (): Promise<never> => {
		throw new Error(
			"This integration test does not invoke native CCIP inference",
		);
	};

	return {
		isServiceAvailable: async () => true,
		getTags: unsupported,
		getTagsForMedia: unsupported,
		getCcipFeature: unsupported,
		getCcipFeatureForMedia: unsupported,
		getCcipDifference: unsupported,
		getCcipDistances: async (_anchor, candidates) =>
			candidates.map((candidate) => candidate[1] ?? Number.POSITIVE_INFINITY),
	};
}

describe("LanceDbCcipVectorStore integration", () => {
	let directory: string | undefined;

	afterEach(async () => {
		if (directory) {
			await rm(directory, { recursive: true, force: true });
			directory = undefined;
		}
	});

	it("persists, reopens, filters, and searches real CCIP vectors", async () => {
		directory = await mkdtemp(
			path.join(tmpdir(), "solid-imager-ccip-lancedb-"),
		);
		const store = new LanceDbCcipVectorStore(directory);
		const anchor = createRecord(ANCHOR_MEDIA_ID, SOURCE_A_ID, vector(1));
		const near = createRecord(NEAR_MEDIA_ID, SOURCE_A_ID, vector(0.875, 0.125));
		const far = createRecord(FAR_MEDIA_ID, SOURCE_A_ID, vector(0, 1));
		const otherSource = createRecord(
			OTHER_SOURCE_MEDIA_ID,
			SOURCE_B_ID,
			vector(0.75, 0.25),
		);

		await store.upsertMany([anchor, near, far, otherSource]);

		const loaded = await store.get(ANCHOR_MEDIA_ID);
		expect(loaded).toEqual(anchor);
		const metadata = await store.getMetadataMany([ANCHOR_MEDIA_ID]);
		expect(metadata.get(ANCHOR_MEDIA_ID)).toEqual({
			mediaId: anchor.mediaId,
			mediaSourceId: anchor.mediaSourceId,
			model: anchor.model,
			embeddingVersion: anchor.embeddingVersion,
			mediaModifiedAt: anchor.mediaModifiedAt,
			extractedAt: anchor.extractedAt,
		});

		const reopenedStore = new LanceDbCcipVectorStore(directory);
		expect(
			await reopenedStore.getMany([ANCHOR_MEDIA_ID, NEAR_MEDIA_ID]),
		).toEqual(
			new Map([
				[ANCHOR_MEDIA_ID, anchor],
				[NEAR_MEDIA_ID, near],
			]),
		);
		expect(await reopenedStore.listMediaIds(SOURCE_A_ID)).toEqual(
			expect.arrayContaining([ANCHOR_MEDIA_ID, NEAR_MEDIA_ID, FAR_MEDIA_ID]),
		);

		const sourceScoped = await reopenedStore.search(
			anchor.vector,
			10,
			SOURCE_A_ID,
		);
		expect(sourceScoped.map((candidate) => candidate.mediaId)).toEqual(
			expect.arrayContaining([ANCHOR_MEDIA_ID, NEAR_MEDIA_ID, FAR_MEDIA_ID]),
		);
		expect(sourceScoped.map((candidate) => candidate.mediaId)).not.toContain(
			OTHER_SOURCE_MEDIA_ID,
		);
	});

	it("reports ready and stale status and searches candidates through the real store", async () => {
		directory = await mkdtemp(
			path.join(tmpdir(), "solid-imager-ccip-lancedb-"),
		);
		const vectorStore = new LanceDbCcipVectorStore(directory);
		const mediaById = new Map<string, Media>([
			[ANCHOR_MEDIA_ID, createMedia(ANCHOR_MEDIA_ID, SOURCE_A_ID)],
			[NEAR_MEDIA_ID, createMedia(NEAR_MEDIA_ID, SOURCE_A_ID)],
			[FAR_MEDIA_ID, createMedia(FAR_MEDIA_ID, SOURCE_A_ID)],
			[OTHER_SOURCE_MEDIA_ID, createMedia(OTHER_SOURCE_MEDIA_ID, SOURCE_B_ID)],
		]);
		const mediaRepository = {
			findById: async (id: string) => mediaById.get(id) ?? null,
			findByIds: async (ids: string[]) =>
				ids.flatMap((id) => {
					const media = mediaById.get(id);
					return media ? [media] : [];
				}),
		} as IMediaRepository;
		const sources = new Map<string, MediaSource>([
			[SOURCE_A_ID, createSource(SOURCE_A_ID)],
			[SOURCE_B_ID, createSource(SOURCE_B_ID)],
		]);
		const sourceRepository = {
			findById: async (id: string) => sources.get(id) ?? null,
		} as SourceRepository;
		const service = new CcipVectorService({
			mediaRepository,
			sourceRepository,
			taggingService: createTaggingService(),
			vectorStore,
		});

		await vectorStore.upsertMany([
			createRecord(ANCHOR_MEDIA_ID, SOURCE_A_ID, vector(1)),
			createRecord(NEAR_MEDIA_ID, SOURCE_A_ID, vector(0.875, 0.125)),
			createRecord(FAR_MEDIA_ID, SOURCE_A_ID, vector(0, 1)),
			createRecord(OTHER_SOURCE_MEDIA_ID, SOURCE_B_ID, vector(0.75, 0.25)),
		]);

		expect(await service.getStatus(SOURCE_A_ID, ANCHOR_MEDIA_ID)).toMatchObject(
			{
				status: "ready",
				model: CCIP_MODEL,
			},
		);
		const anchorMedia = mediaById.get(ANCHOR_MEDIA_ID);
		if (!anchorMedia) {
			throw new Error("Anchor media fixture is missing");
		}
		mediaById.set(ANCHOR_MEDIA_ID, {
			...anchorMedia,
			modifiedAt: new Date(EXTRACTED_AT.getTime() + 1),
		});
		expect(await service.getStatus(SOURCE_A_ID, ANCHOR_MEDIA_ID)).toMatchObject(
			{
				status: "stale",
			},
		);
		mediaById.set(ANCHOR_MEDIA_ID, anchorMedia);

		const result = await service.searchSimilar(ANCHOR_MEDIA_ID, 2, SOURCE_A_ID);
		expect(result.media.map((media) => media.id)).toEqual([
			NEAR_MEDIA_ID,
			FAR_MEDIA_ID,
		]);
		expect(result.scores.map((score) => score.mediaId)).toEqual([
			NEAR_MEDIA_ID,
			FAR_MEDIA_ID,
		]);
	});
});
