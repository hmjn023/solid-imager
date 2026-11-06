import { CcipVectorService } from "@solid-imager/application/ccip";
import { describe, expect, it, vi } from "vitest";

const source = { id: "00000000-0000-4000-8000-000000000010", type: "local" };
const media = {
	id: "00000000-0000-4000-8000-000000000001",
	mediaSourceId: source.id,
	mediaType: "image",
	modifiedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("CcipVectorService", () => {
	it.each(["image", "video"])(
		"skips extraction when the stored %s vector is current",
		async (mediaType) => {
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
					findById: vi.fn().mockResolvedValue({ ...media, mediaType }),
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
		},
	);

	it("persists successful batch extractions with one bulk upsert", async () => {
		const secondMedia = {
			...media,
			id: "00000000-0000-4000-8000-000000000002",
			mediaType: "video",
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

	it.each(["image", "video"])(
		"returns cosine-ranked pages for a %s anchor without invoking CCIP inference",
		async (mediaType) => {
			const anchorVector = Array.from({ length: 768 }, () => 0);
			const candidateA = {
				...media,
				id: "00000000-0000-4000-8000-000000000002",
				mediaType: "video",
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
			const getCcipDistances = vi.fn();
			const search = vi.fn().mockResolvedValue({
				candidates: [
					{ mediaId: candidateA.id, cosineDistance: 0.1 },
					{ mediaId: candidateB.id, cosineDistance: 0.2 },
				],
				total: 12,
			});
			const service = new CcipVectorService({
				mediaRepository: {
					findById: vi.fn().mockResolvedValue({ ...media, mediaType }),
					findByIds: vi.fn().mockResolvedValue([candidateA, candidateB]),
				} as any,
				sourceRepository: {
					findById: vi.fn().mockResolvedValue(source),
				} as any,
				taggingService: {
					getCcipDistances,
				} as any,
				vectorStore: {
					get: vi.fn().mockResolvedValue(record(media, anchorVector)),
					search,
				} as any,
			});

			const result = await service.searchSimilar(media.id, 10, undefined, 2, 3);

			expect(result.media.map((item) => item.id)).toEqual([
				candidateA.id,
				candidateB.id,
			]);
			expect(result.scores.map((item) => item.cosineDistance)).toEqual([
				0.1, 0.2,
			]);
			expect(result.total).toBe(10);
			expect(search).toHaveBeenCalledWith(
				anchorVector,
				2,
				expect.anything(),
				3,
				media.id,
			);
			expect(getCcipDistances).not.toHaveBeenCalled();
		},
	);

	it("extracts video vectors, reports status, and reruns stale or forced extraction", async () => {
		const video = { ...media, mediaType: "video" };
		const feature = Array.from({ length: 768 }, (_, index) =>
			index === 0 ? 1 : 0,
		);
		const taggingService = {
			getCcipFeatureForMedia: vi.fn().mockResolvedValue({ feature }),
		};
		const vectorStore = {
			get: vi.fn().mockResolvedValue(null),
			upsert: vi.fn(),
		};
		const service = new CcipVectorService({
			mediaRepository: { findById: vi.fn().mockResolvedValue(video) } as any,
			sourceRepository: { findById: vi.fn().mockResolvedValue(source) } as any,
			taggingService: taggingService as any,
			vectorStore: vectorStore as any,
		});
		expect(await service.getStatus(source.id, media.id)).toEqual({
			status: "missing",
		});
		const result = await service.extract(source.id, media.id);
		expect(result.skipped).toBe(false);
		expect(taggingService.getCcipFeatureForMedia).toHaveBeenCalledWith(
			source.id,
			media.id,
		);
		expect(vectorStore.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				mediaId: media.id,
				vector: feature,
				mediaModifiedAt: media.modifiedAt,
			}),
		);
		vectorStore.get.mockResolvedValue(result.record);
		expect(await service.getStatus(source.id, media.id)).toEqual(
			expect.objectContaining({ status: "ready" }),
		);
		vectorStore.get.mockResolvedValue({
			...result.record,
			extractedAt: new Date("2025-01-01"),
		});
		expect(await service.getStatus(source.id, media.id)).toEqual(
			expect.objectContaining({ status: "stale" }),
		);
		await service.extract(source.id, media.id);
		vectorStore.get.mockResolvedValue(result.record);
		await service.extract(source.id, media.id, true);
		expect(taggingService.getCcipFeatureForMedia).toHaveBeenCalledTimes(3);
	});

	it("rejects audio, mismatched sources and remote videos before inference", async () => {
		const mediaRepository = {
			findById: vi.fn().mockResolvedValue({ ...media, mediaType: "video" }),
		};
		const sourceRepository = { findById: vi.fn().mockResolvedValue(source) };
		const taggingService = { getCcipFeatureForMedia: vi.fn() };
		const service = new CcipVectorService({
			mediaRepository: mediaRepository as any,
			sourceRepository: sourceRepository as any,
			taggingService: taggingService as any,
			vectorStore: { get: vi.fn().mockResolvedValue(null) } as any,
		});
		await expect(service.extract("another-source", media.id)).rejects.toThrow(
			"Media not found in source",
		);
		mediaRepository.findById.mockResolvedValue({
			...media,
			mediaType: "audio",
		});
		await expect(service.extract(source.id, media.id)).rejects.toThrow(
			"only supports images and video thumbnails",
		);
		await expect(service.getStatus(source.id, media.id)).rejects.toThrow(
			"only supports images and video thumbnails",
		);
		mediaRepository.findById.mockResolvedValue({
			...media,
			mediaType: "video",
		});
		sourceRepository.findById.mockResolvedValue({ ...source, type: "s3" });
		await expect(service.extract(source.id, media.id)).rejects.toThrow(
			"only supports local sources",
		);
		expect(taggingService.getCcipFeatureForMedia).not.toHaveBeenCalled();
	});
});
