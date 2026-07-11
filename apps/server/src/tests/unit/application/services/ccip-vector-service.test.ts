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
			vector: Array.from({ length: 768 }, () => 0),
			model: "ccip-caformer-24-randaug-pruned",
			embeddingVersion: 1,
			mediaModifiedAt: new Date(media.modifiedAt.getTime() - 500),
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

	it("persists successful batch extractions with one bulk upsert", async () => {
		const secondMedia = {
			...media,
			id: "00000000-0000-4000-8000-000000000002",
		};
		const vectorStore = {
			getMany: vi.fn().mockResolvedValue(new Map()),
			upsertMany: vi.fn().mockResolvedValue(undefined),
		};
		const taggingService = {
			getCcipFeatureForMedia: vi
				.fn()
				.mockResolvedValueOnce({
					feature: Array.from({ length: 768 }, () => 1),
				})
				.mockResolvedValueOnce({
					feature: Array.from({ length: 768 }, () => 2),
				}),
		};
		const service = new CcipVectorService({
			mediaRepository: {
				findById: vi.fn((id: string) =>
					Promise.resolve(id === media.id ? media : secondMedia),
				),
			} as any,
			sourceRepository: {
				findById: vi.fn().mockResolvedValue(source),
			} as any,
			taggingService: taggingService as any,
			vectorStore: vectorStore as any,
		});

		const results = await service.extractBatch(source.id, [
			media.id,
			secondMedia.id,
		]);

		expect(results.every((result) => result.status === "fulfilled")).toBe(true);
		expect(vectorStore.getMany).toHaveBeenCalledOnce();
		expect(vectorStore.upsertMany).toHaveBeenCalledOnce();
		expect(vectorStore.upsertMany.mock.calls[0]?.[0]).toEqual([
			expect.objectContaining({ mediaId: media.id }),
			expect.objectContaining({ mediaId: secondMedia.id }),
		]);
	});

	it("reranks LanceDB candidates using CCIP distance", async () => {
		const anchorVector = Array.from({ length: 768 }, () => 0);
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
						...record(
							candidateA,
							Array.from({ length: 768 }, () => 1),
						),
						cosineDistance: 0.1,
					},
					{
						...record(
							candidateB,
							Array.from({ length: 768 }, () => 2),
						),
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
