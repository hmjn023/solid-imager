import {
	CcipVectorService,
	getCcipTaskRevision,
} from "@solid-imager/application/services/ccip-vector-service";
import { describe, expect, it, vi } from "vitest";

const source = {
	id: "00000000-0000-4000-8000-000000000010",
	type: "local",
	connectionInfo: { path: "/fixture" },
};
const media = {
	id: "00000000-0000-4000-8000-000000000001",
	mediaSourceId: source.id,
	mediaType: "image",
	filePath: "image.png",
	fileSize: 100,
	modifiedAt: new Date("2026-01-01T00:00:00Z"),
};

const settings = {
	model: "ccip-caformer-24-randaug-pruned",
	modelVersion: "native-v1",
	runtimeVersion: "test",
	provider: "cpu",
	device: null,
	endpoint: "",
	embeddingVersion: 1,
	dimensions: 768,
};
const revision = (item: typeof media) =>
	getCcipTaskRevision(
		{
			mediaId: item.id,
			mediaSourceId: item.mediaSourceId,
			mediaType: "image",
			sourcePath: "/fixture",
			filePath: item.filePath,
			fileSize: item.fileSize,
			modifiedAt: item.modifiedAt,
		},
		settings,
	);
function taskDeps(items: (typeof media)[], cached = false) {
	return {
		getCcipSettings: () => settings,
		transactionManager: { transaction: async (action: any) => action({}) },
		jobRepo: {} as any,
		processingStateRepo: {
			claim: vi.fn(async (input: any) =>
				cached
					? { status: "completed" }
					: {
							status: "claimed",
							claim: {
								mediaId: input.mediaId,
								taskKind: "ccip",
								revision: revision(input),
								token: "token",
							},
						},
			),
			commit: vi.fn(async (_input: any, _claim: any, save: any) => save({})),
			fail: vi.fn(),
			findByMediaIds: vi.fn(async () =>
				items.map((item) => ({
					mediaId: item.id,
					taskKind: "ccip",
					status: "completed",
					requestedRevision: revision(item),
					completedRevision: revision(item),
				})),
			),
		} as any,
	};
}

describe("CcipVectorService", () => {
	it("skips extraction when the stored vector is current", async () => {
		const record = {
			mediaId: media.id,
			mediaSourceId: source.id,
			vector: Array.from({ length: 768 }, () => 0),
			model: "ccip-caformer-24-randaug-pruned",
			embeddingVersion: 1,
			mediaModifiedAt: media.modifiedAt,
			processingRevision: revision(media),
			extractedAt: new Date(),
		};
		const taggingService = { getCcipFeatureForMedia: vi.fn() };
		const service = new CcipVectorService({
			...taskDeps([media], true),
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

	it("persists each successful batch extraction inside its claim transaction", async () => {
		const secondMedia = {
			...media,
			id: "00000000-0000-4000-8000-000000000002",
		};
		const vectorStore = {
			get: vi.fn().mockResolvedValue(null),
			upsert: vi.fn().mockResolvedValue(undefined),
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
			...taskDeps([media, secondMedia]),
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
		expect(vectorStore.upsert).toHaveBeenCalledTimes(2);
		expect(vectorStore.upsert.mock.calls.map((call) => call[0])).toEqual([
			expect.objectContaining({ mediaId: media.id }),
			expect.objectContaining({ mediaId: secondMedia.id }),
		]);
	});

	it("reranks vector candidates using CCIP distance", async () => {
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
			processingRevision: revision(item),
			extractedAt: new Date(),
		});
		const service = new CcipVectorService({
			...taskDeps([media, candidateA, candidateB], true),
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
