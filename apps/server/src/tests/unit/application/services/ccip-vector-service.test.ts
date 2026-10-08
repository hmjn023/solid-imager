import {
	CcipVectorService,
	getCcipTaskRevision,
} from "@solid-imager/application/services/ccip-vector-service";
import { randomUUID } from "node:crypto";
import { runScheduledObserver } from "../../../integration/media/run-scheduled-observer";
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
	const states = new Map<string, any>(
		cached
			? items.map((item) => [
					item.id,
					{
						mediaId: item.id,
						requestId: randomUUID(),
						taskKind: "ccip",
						requestedRevision: revision(item),
						completedRevision: revision(item),
						status: "completed",
					},
				])
			: [],
	);
	return {
		getCcipSettings: () => settings,
		transactionManager: { transaction: async (action: any) => action({}) },
		jobRepo: {} as any,
		processingStateRepo: {
			request: vi.fn(async ({ input, revision }: any) => {
				let state = states.get(input.mediaId);
				if (!state) {
					state = {
						mediaId: input.mediaId,
						requestId: randomUUID(),
						taskKind: "ccip",
						requestedRevision: revision,
						status: "pending",
						input,
					};
					states.set(input.mediaId, state);
				}
				return state;
			}),
			claimDue: vi.fn(async () => {
				const state = Array.from(states.values()).find(
					(state) => state.status === "pending",
				);
				if (!state) return null;
				state.status = "in_progress";
				return {
					input: state.input,
					state,
					claim: {
						mediaId: state.mediaId,
						taskKind: "ccip",
						revision: state.requestedRevision,
						token: randomUUID(),
					},
				};
			}),
			recoverExpired: vi.fn(),
			heartbeat: vi.fn(),
			settleFailure: vi.fn(),
			commit: vi.fn(async (_input: any, claim: any, save: any, tx: any) => {
				await save(tx);
				states.get(claim.mediaId).status = "completed";
			}),
			findByMediaIds: vi.fn(async (ids: string[]) =>
				ids.flatMap((id) => (states.has(id) ? [states.get(id)] : [])),
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
		const taggingService = { inferCcip: vi.fn() };
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
		expect(taggingService.inferCcip).not.toHaveBeenCalled();
	});

	it("persists each successful batch extraction inside its claim transaction", async () => {
		const secondMedia = {
			...media,
			id: "00000000-0000-4000-8000-000000000002",
		};
		const stored = new Map<string, any>();
		const vectorStore = {
			get: vi.fn(async (id: string) => stored.get(id) ?? null),
			upsert: vi.fn(async (record: any) => {
				stored.set(record.mediaId, record);
			}),
		};
		const taggingService = {
			inferCcip: vi
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

		const results = await runScheduledObserver(
			service.extractBatch(source.id, [media.id, secondMedia.id]),
			() => service.runTask(),
		);

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
