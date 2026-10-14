import { createRouterClient } from "@orpc/server";
import { aiRouter } from "~/infrastructure/api/routers/ai-router";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "~/infrastructure/db";
import {
	jobs,
	medias,
	mediaSources,
	batchRuns,
} from "~/infrastructure/db/schema";
import { services } from "~/infrastructure/service-registry";
import { MediaProcessingStateRepository } from "~/infrastructure/repositories/media-processing-state-repository";
import { BatchRunRepository } from "~/infrastructure/repositories/batch-run-repository";
import { batchRunService } from "~/infrastructure/services/batch-run-service";
import { taggingService } from "~/infrastructure/services/tagging-service";
import { ccipVectorService } from "~/infrastructure/services/ccip-vector-service";

describe("dedicated AI batch producers", () => {
	let sourceId: string;
	let mediaIds: string[];
	beforeEach(async () => {
		await services.getJobWorker().stop();
		await services.getMediaFileWorker().stop();
		await services.getMediaAiWorker().stop();
		sourceId = (
			await services.getSourceRepository().create({
				name: "AI batch",
				description: null,
				type: "local",
				connectionInfo: { path: "/isolated-fixture" },
			})
		).id;
		mediaIds = (
			await db
				.insert(medias)
				.values(
					["first.png", "second.png"].map((filePath) => ({
						mediaSourceId: sourceId,
						filePath,
						fileName: filePath,
						mediaType: "image" as const,
						width: 1,
						height: 1,
						fileSize: 100,
						modifiedAt: new Date("2026-01-01"),
					})),
				)
				.returning()
		).map((row) => row.id);
	});
	afterEach(async () => {
		vi.restoreAllMocks();
		await db
			.delete(batchRuns)
			.where(sql`${batchRuns.input}->>'mediaSourceId' = ${sourceId}`);
		await db.delete(mediaSources).where(eq(mediaSources.id, sourceId));
	});

	const reserve = async () => {
		const [claim] = await BatchRunRepository.claimPending(1);
		if (!claim) throw new Error("Batch claim missing");
		await batchRunService.dispatch(claim);
		await batchRunService.reconcile();
	};
	it.each(["tagging", "ccip"] as const)(
		"binds %s fixed targets before inference and preserves results after restart",
		async (kind) => {
			const inferTag = vi
				.spyOn(services.getAiClient(), "tagImageByPath")
				.mockResolvedValue({
					general: {},
					character: {},
					attributes: {},
					ips: [],
					ips_mapping: {},
				});
			const inferCcip = vi
				.spyOn(services.getAiClient(), "extractCcipFeatureByPath")
				.mockResolvedValue({ feature: Array.from({ length: 768 }, () => 0.5) });
			const client = createRouterClient(aiRouter);
			const batch = await (kind === "tagging"
				? client.startBatchTagging({ mediaSourceId: sourceId, force: true })
				: client.startBatchCcipExtraction({
						mediaSourceId: sourceId,
						force: true,
					}));
			expect(
				(await BatchRunRepository.listItems(batch.jobId, 100, 0)).total,
			).toBe(2);
			await reserve();
			const requests =
				await MediaProcessingStateRepository.findByMediaIds(mediaIds);
			expect(requests).toHaveLength(2);
			expect(
				requests.every(
					(state) => state.taskKind === kind && state.status === "pending",
				),
			).toBe(true);
			expect(inferTag).not.toHaveBeenCalled();
			expect(inferCcip).not.toHaveBeenCalled();
			expect(
				await db.select().from(jobs).where(eq(jobs.mediaSourceId, sourceId)),
			).toEqual([]);
			for (const _ of mediaIds)
				expect(
					await (kind === "tagging"
						? taggingService.runTaggingTask()
						: ccipVectorService.runTask()),
				).toBe("completed");
			expect(
				(await BatchRunRepository.findById(batch.jobId))?.progress,
			).toMatchObject({ total: 2, completed: 2, failed: 0 });
			const item = (await BatchRunRepository.listItems(batch.jobId, 100, 0))
				.items[0];
			expect(
				(await BatchRunRepository.listAttempts(item.id, 100, 0)).items,
			).toEqual([
				expect.objectContaining({ status: "completed", attemptCount: 1 }),
			]);
		},
	);
	it.each(["tagging", "ccip"] as const)(
		"rolls back a %s reservation page atomically",
		async (kind) => {
			const batch = await batchRunService.start({
				kind,
				mediaSourceId: sourceId,
				force: true,
				missingOnly: false,
				thumbnailSize: 512,
			});
			const original = MediaProcessingStateRepository.request;
			let calls = 0;
			vi.spyOn(MediaProcessingStateRepository, "request").mockImplementation(
				async (request, tx) => {
					if (++calls === 2) throw new Error("reservation unavailable");
					return original(request, tx);
				},
			);
			await expect(reserve()).rejects.toThrow("reservation unavailable");
			expect(
				await MediaProcessingStateRepository.findByMediaIds(mediaIds),
			).toEqual([]);
			expect(
				(await BatchRunRepository.listItems(batch.run.id, 100, 0)).items.every(
					(item) => item.status === "pending" && !item.requestId,
				),
			).toBe(true);
		},
	);
	it("queues one CCIP target, then exposes its dedicated failure", async () => {
		const client = createRouterClient(aiRouter);
		const result = await client.startCcipExtraction({
			mediaSourceId: sourceId,
			mediaId: mediaIds[0],
			force: false,
		});
		expect(
			(await BatchRunRepository.listItems(result.jobId, 100, 0)).total,
		).toBe(1);
		expect(
			await client.ccipVectorStatus({
				mediaSourceId: sourceId,
				mediaId: mediaIds[0],
			}),
		).toMatchObject({ status: "processing", jobId: result.jobId });
		await reserve();
		vi.spyOn(
			services.getAiClient(),
			"extractCcipFeatureByPath",
		).mockRejectedValueOnce(new Error("invalid image"));
		expect(await ccipVectorService.runTask()).toBe("failed");
		expect(
			await client.ccipVectorStatus({
				mediaSourceId: sourceId,
				mediaId: mediaIds[0],
			}),
		).toMatchObject({
			status: "failed",
			error: "CCIP vector extraction failed",
		});
	});
	it("rolls back target capture if a fixed item insert fails", async () => {
		vi.spyOn(BatchRunRepository, "appendTargets").mockRejectedValueOnce(
			new Error("item insert unavailable"),
		);
		await expect(
			createRouterClient(aiRouter).startCcipExtraction({
				mediaSourceId: sourceId,
				mediaId: mediaIds[0],
				force: false,
			}),
		).rejects.toThrow("item insert unavailable");
		expect(
			await MediaProcessingStateRepository.findByMediaIds(mediaIds),
		).toEqual([]);
		expect(
			await db
				.select()
				.from(batchRuns)
				.where(sql`${batchRuns.input}->>'mediaSourceId' = ${sourceId}`),
		).toEqual([]);
	});
});
