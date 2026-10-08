import { createRouterClient } from "@orpc/server";
import { aiRouter } from "~/infrastructure/api/routers/ai-router";
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiProcessingObserverSchema } from "@solid-imager/core/domain/processing/schemas";
import { db } from "~/infrastructure/db";
import { jobs, medias, mediaSources } from "~/infrastructure/db/schema";
import { services } from "~/infrastructure/service-registry";
import { MediaProcessingStateRepository } from "~/infrastructure/repositories/media-processing-state-repository";
import { taggingService } from "~/infrastructure/services/tagging-service";
import { ccipVectorService } from "~/infrastructure/services/ccip-vector-service";
import {
	processAutoTaggingJob,
	processBulkTaggingDispatchJob,
} from "~/infrastructure/jobs/tagging-jobs";
import {
	processCcipExtractionJob,
	processBatchCcipDispatchJob,
} from "~/infrastructure/jobs/ccip-jobs";

describe("dedicated AI batch producers", () => {
	let sourceId: string;
	let mediaIds: string[];
	beforeEach(async () => {
		services.getJobWorker().stop();
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
		await db.delete(mediaSources).where(eq(mediaSources.id, sourceId));
	});
	const dispatch = async (kind: "tagging" | "ccip") => {
		const repo = services.getJobRepository();
		const parent = await repo.create({
			type: kind === "tagging" ? "bulk_tagging_parent" : "batch_ccip_parent",
			mediaSourceId: sourceId,
			payload: { processed: 0, failed: 0, total: 2 },
		});
		const job = await repo.create({
			type:
				kind === "tagging" ? "bulk_tagging_dispatch" : "batch_ccip_dispatch",
			mediaSourceId: sourceId,
			parentId: parent.id,
			payload: { mediaSourceId: sourceId, force: true },
		});
		await (kind === "tagging"
			? processBulkTaggingDispatchJob(job)
			: processBatchCcipDispatchJob(job));
		return parent;
	};
	it.each(["tagging", "ccip"] as const)(
		"binds %s batch identities before inference and retains parent progress",
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
			const parent = await dispatch(kind);
			const requests =
				await MediaProcessingStateRepository.findByMediaIds(mediaIds);
			expect(requests).toHaveLength(2);
			expect(
				requests.every(
					(state) =>
						state.taskKind === kind &&
						state.status === "pending" &&
						state.attemptCount === 0,
				),
			).toBe(true);
			const type = kind === "tagging" ? "auto_tagging" : "extract_ccip_vector";
			const children = await services
				.getJobRepository()
				.claimPending(10, { includeTypes: [type] });
			expect(children).toHaveLength(kind === "tagging" ? 2 : 1);
			for (const child of children) {
				const payload = aiProcessingObserverSchema.parse(child.payload);
				expect(payload.force).toBe(false);
				for (const [mediaId, identity] of Object.entries(
					payload.processingRequests ?? {},
				)) {
					expect(
						requests.find((state) => state.mediaId === mediaId),
					).toMatchObject(identity);
				}
			}
			expect(inferTag).not.toHaveBeenCalled();
			expect(inferCcip).not.toHaveBeenCalled();
			// Dedicated work completes independently before generic observers run.
			for (const _ of mediaIds)
				expect(
					await (kind === "tagging"
						? taggingService.runTaggingTask()
						: ccipVectorService.runTask()),
				).toBe("completed");
			for (const child of children)
				await (kind === "tagging"
					? processAutoTaggingJob(child)
					: processCcipExtractionJob(child));
			expect(kind === "tagging" ? inferTag : inferCcip).toHaveBeenCalledTimes(
				2,
			);
			expect(
				await services.getJobRepository().findById(parent.id),
			).toMatchObject({
				status: "completed",
				payload: { processed: 2, failed: 0, total: 2 },
			});
			expect(
				(await MediaProcessingStateRepository.findByMediaIds(mediaIds))
					.map((state) => state.requestId)
					.sort(),
			).toEqual(requests.map((state) => state.requestId).sort());
		},
	);
	it.each(["tagging", "ccip"] as const)(
		"rolls back %s reservations and children together",
		async (kind) => {
			const original = MediaProcessingStateRepository.request;
			let calls = 0;
			vi.spyOn(MediaProcessingStateRepository, "request").mockImplementation(
				async (request, tx) => {
					if (++calls === 2) throw new Error("reservation unavailable");
					return original(request, tx);
				},
			);
			await expect(dispatch(kind)).rejects.toThrow("reservation unavailable");
			expect(
				await MediaProcessingStateRepository.findByMediaIds(mediaIds),
			).toEqual([]);
			expect(
				await db
					.select()
					.from(jobs)
					.where(
						and(
							eq(jobs.mediaSourceId, sourceId),
							eq(
								jobs.type,
								kind === "tagging" ? "auto_tagging" : "extract_ccip_vector",
							),
						),
					),
			).toEqual([]);
		},
	);
	it("reserves a direct CCIP job eagerly and shows terminal failure before its observer runs", async () => {
		const client = createRouterClient(aiRouter);
		const result = await client.startCcipExtraction({
			mediaSourceId: sourceId,
			mediaId: mediaIds[0],
			force: false,
		});
		const [request] = await MediaProcessingStateRepository.findByMediaIds([
			mediaIds[0],
		]);
		expect(request).toMatchObject({
			taskKind: "ccip",
			status: "pending",
			attemptCount: 0,
		});
		expect(
			await services.getJobRepository().findById(result.jobId),
		).toMatchObject({
			status: "pending",
			payload: {
				processingRequests: {
					[mediaIds[0]]: {
						requestId: request.requestId,
						requestedRevision: request.requestedRevision,
					},
				},
			},
		});
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
	it("rolls back a direct CCIP reservation if observer insertion fails", async () => {
		vi.spyOn(services.getJobRepository(), "create").mockRejectedValueOnce(
			new Error("job insert unavailable"),
		);
		await expect(
			createRouterClient(aiRouter).startCcipExtraction({
				mediaSourceId: sourceId,
				mediaId: mediaIds[0],
				force: false,
			}),
		).rejects.toThrow("job insert unavailable");
		expect(
			await MediaProcessingStateRepository.findByMediaIds(mediaIds),
		).toEqual([]);
	});
});
