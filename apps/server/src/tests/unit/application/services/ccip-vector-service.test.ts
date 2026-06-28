import { CcipVectorService } from "@solid-imager/application/services/ccip-vector-service";
import { describe, expect, it, vi } from "vitest";

const source = { id: "00000000-0000-4000-8000-000000000010", type: "local" };
const media = {
	id: "00000000-0000-4000-8000-000000000001",
	mediaSourceId: source.id,
	mediaType: "image",
	modifiedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("CcipVectorService", () => {
	it("skips extraction when the stored vector is current", async () => {
		const record = {
			mediaId: media.id,
			mediaSourceId: source.id,
			vector: new Array(768).fill(0),
			model: "ccip-caformer-24-randaug-pruned",
			embeddingVersion: 1,
			mediaModifiedAt: media.modifiedAt,
			extractedAt: new Date(),
		};
		const taggingService = { getCcipFeatureForMedia: vi.fn() };
		const service = new CcipVectorService({
			mediaRepository: {
				findById: vi.fn().mockResolvedValue(media),
			} as any,
			sourceRepository: {
				findById: vi.fn().mockResolvedValue(source),
			} as any,
			taggingService: taggingService as any,
			vectorStore: {
				get: vi.fn().mockResolvedValue(record),
			} as any,
		});

		const result = await service.extract(source.id, media.id);

		expect(result.skipped).toBe(true);
		expect(taggingService.getCcipFeatureForMedia).not.toHaveBeenCalled();
	});

	it("treats a vector from the previous source as stale after a move", async () => {
		const service = new CcipVectorService({
			mediaRepository: {
				findById: vi.fn().mockResolvedValue(media),
			} as any,
			sourceRepository: {
				findById: vi.fn().mockResolvedValue(source),
			} as any,
			taggingService: {} as any,
			vectorStore: {
				get: vi.fn().mockResolvedValue({
					mediaId: media.id,
					mediaSourceId: "00000000-0000-4000-8000-000000000099",
					vector: new Array(768).fill(0),
					model: "ccip-caformer-24-randaug-pruned",
					embeddingVersion: 1,
					mediaModifiedAt: media.modifiedAt,
					extractedAt: new Date(),
				}),
			} as any,
		});

		await expect(service.getStatus(source.id, media.id)).resolves.toMatchObject(
			{
				status: "stale",
			},
		);
	});

	it("reranks LanceDB candidates using CCIP distance", async () => {
		const anchorVector = new Array(768).fill(0);
		const candidateA = {
			...media,
			id: "00000000-0000-4000-8000-000000000002",
		};
		const candidateB = {
			...media,
			id: "00000000-0000-4000-8000-000000000003",
		};
		const record = (item: typeof media, vector: number[]) => ({
			mediaId: item.id,
			mediaSourceId: source.id,
			vector,
			model: "ccip-caformer-24-randaug-pruned",
			embeddingVersion: 1,
			mediaModifiedAt: item.modifiedAt,
			extractedAt: new Date(),
		});
		const service = new CcipVectorService({
			mediaRepository: {
				findById: vi.fn().mockResolvedValue(media),
				findByIds: vi.fn().mockResolvedValue([candidateA, candidateB]),
			} as any,
			sourceRepository: {
				findById: vi.fn().mockResolvedValue(source),
			} as any,
			taggingService: {
				getCcipDistances: vi.fn().mockResolvedValue([0.4, 0.1]),
			} as any,
			vectorStore: {
				get: vi.fn().mockResolvedValue(record(media, anchorVector)),
				search: vi.fn().mockResolvedValue([
					{
						...record(candidateA, new Array(768).fill(1)),
						cosineDistance: 0.1,
					},
					{
						...record(candidateB, new Array(768).fill(2)),
						cosineDistance: 0.2,
					},
				]),
			} as any,
		});

		const result = await service.searchSimilar(media.id, 2);

		expect(result.media.map((item) => item.id)).toEqual([
			candidateB.id,
			candidateA.id,
		]);
		expect(result.scores.map((item) => item.ccipDistance)).toEqual([0.1, 0.4]);
	});
});
