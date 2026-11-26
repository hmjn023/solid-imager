import { notifyJob } from "~/infrastructure/events/state-notifications";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import path from "node:path";
import { implement, ORPCError } from "@orpc/server";
import { aiContract } from "@solid-imager/core/contract";
import { localConnectionSchema } from "@solid-imager/core/sources";
import { sql } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import { logger } from "~/infrastructure/logger";
import { services } from "~/infrastructure/service-registry";
import { ccipVectorService } from "~/infrastructure/services/ccip-vector-service";
import { taggingService } from "~/infrastructure/services/tagging-service";
import { resolveVideoThumbnail } from "~/infrastructure/services/video-thumbnail";
import {
	countCcipTargets,
	countTaggingTargets,
} from "~/infrastructure/services/ai-batch-targets";
import {
	countEmbeddingTargets,
	queueEmbeddingBatch,
} from "~/infrastructure/jobs/embedding-jobs";

async function resolveCharacterCropPath(mediaId: string): Promise<string> {
	const media = await services.getMediaRepository().findById(mediaId);
	if (!media) throw new Error("Media not found");
	const source = await services
		.getSourceRepository()
		.findById(media.mediaSourceId);
	if (!source) throw new Error("Media source not found");
	if (source.type !== "local")
		throw new Error(
			"Only local media sources are supported for character detection",
		);
	const connection = localConnectionSchema.parse(source.connectionInfo);
	return path.join(connection.path, media.filePath);
}

const os = implement(aiContract);

/** Initial progress is a post-commit hint; its delivery cannot undo batch acceptance. */
function notifyBatchQueued(jobId: string): void {
	try {
		RealtimeEventBus.publishJob("job-progress", {
			jobId,
			created: true,
			processed: 0,
			total: 0,
		});
	} catch (error) {
		logger.error(
			{ err: error, jobId },
			"Failed to notify committed batch acceptance",
		);
	}
}

export const aiRouter = os.router({
	offload: os.offload.handler(async () => {
		await services.getAiClient().offload();
		return {};
	}),
	startEmbeddingExtraction: os.startEmbeddingExtraction.handler(
		async ({ input }) => {
			const job = await services.getJobRepository().create({
				type: "extract_embedding_vector",
				mediaSourceId: input.mediaSourceId,
				payload: { mediaId: input.mediaId, force: input.force },
			});
			return {
				success: true,
				message: "EmbeddingGemma 2 extraction queued",
				jobId: job.id,
			};
		},
	),
	embeddingText: os.embeddingText.handler(async ({ input }) => ({
		feature: await services.getAiClient().extractTextEmbedding(input.text),
	})),
	embeddingImage: os.embeddingImage.handler(async ({ input }) => ({
		feature: await services.getAiClient().extractImageEmbedding(input.file),
	})),
	scanBatchEmbeddingTargets: os.scanBatchEmbeddingTargets.handler(
		async ({ input }) => ({ count: await countEmbeddingTargets(input) }),
	),
	startBatchEmbeddingExtraction: os.startBatchEmbeddingExtraction.handler(
		async ({ input }) => {
			const job = await queueEmbeddingBatch(input);
			notifyJob("job-progress", {
				jobId: job.id,
				created: true,
				processed: 0,
				total: job.total,
			});
			if (!job.total)
				notifyJob("job-completed", {
					jobId: job.id,
					message: "Batch completed",
				});
			return {
				success: true,
				message: "EmbeddingGemma 2 indexing queued",
				jobId: job.id,
			};
		},
	),
	health: os.health.handler(async () => {
		const config = services.getConfigService().getConfig();
		const mode = config.ai.baseUrl?.trim() ? "remote" : "local";
		const startedAt = performance.now();
		let available = false;

		try {
			available = await services.getAiClient().healthCheck();
		} catch {
			available = false;
		}

		return {
			status: available ? "available" : "unavailable",
			mode,
			latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
			message: available ? null : "AI service is unavailable",
			checkedAt: new Date(),
		};
	}),
	tag: os.tag.handler(async ({ input }) => {
		const startedAt = Date.now();
		const logContext =
			"file" in input
				? {
						inputType: "file",
						fileSize: input.file.size,
					}
				: {
						inputType: "media",
						mediaSourceId: input.mediaSourceId,
						mediaId: input.mediaId,
					};
		logger.info(logContext, "AI tagging started");
		try {
			if ("file" in input) {
				const buffer = await input.file.arrayBuffer();
				const result = await taggingService.getTags(buffer);
				logger.info(
					{ ...logContext, durationMs: Date.now() - startedAt },
					"AI tagging completed",
				);
				return result;
			}

			const { mediaSourceId, mediaId } = input;
			if (!(mediaSourceId && mediaId)) {
				throw new Error("mediaSourceId and mediaId are required");
			}

			const result = await taggingService.getTagsForMedia(
				mediaSourceId,
				mediaId,
			);
			if (!result) {
				throw new Error("AI tagging is unavailable for this media source");
			}
			logger.info(
				{
					...logContext,
					durationMs: Date.now() - startedAt,
				},
				"AI tagging completed",
			);
			return result;
		} catch (error) {
			logger.error(
				{
					err: error,
					...logContext,
					durationMs: Date.now() - startedAt,
				},
				"AI tagging failed",
			);
			if (error instanceof ORPCError) throw error;
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new ORPCError("UNPROCESSABLE_CONTENT", {
				message: `AI tagging failed: ${message}`,
			});
		}
	}),

	tagOppaiOracle: os.tagOppaiOracle.handler(async ({ input }) => {
		const startedAt = Date.now();
		logger.info(
			{ inputType: "file" in input ? "file" : "media" },
			"OppaiOracle tagging started",
		);
		try {
			if ("file" in input) {
				const result = await services
					.getAiClient()
					.tagImageOppaiOracle(input.file);
				logger.info(
					{ durationMs: Date.now() - startedAt },
					"OppaiOracle tagging completed",
				);
				return result;
			}

			const { mediaSourceId, mediaId } = input;
			if (!(mediaSourceId && mediaId)) {
				throw new Error("mediaSourceId and mediaId are required");
			}

			const media = await services.getMediaRepository().findById(mediaId);
			if (!media || media.mediaSourceId !== mediaSourceId) {
				throw new Error("Media not found in source");
			}
			if (media.mediaType !== "image" && media.mediaType !== "video") {
				throw new Error(
					"OppaiOracle supports images and video thumbnails only",
				);
			}
			const mediaSource = await services
				.getSourceRepository()
				.findById(media.mediaSourceId);
			if (mediaSource?.type !== "local") {
				throw new Error(
					"Only local media sources are supported for OppaiOracle tagging",
				);
			}
			const connection = localConnectionSchema.parse(
				mediaSource.connectionInfo,
			);
			const fullPath =
				media.mediaType === "video"
					? await resolveVideoThumbnail(media)
					: path.join(connection.path, media.filePath);

			const result = await services
				.getAiClient()
				.tagImageOppaiOracleByPath(fullPath);
			logger.info(
				{ durationMs: Date.now() - startedAt },
				"OppaiOracle tagging completed",
			);
			return result;
		} catch (error) {
			logger.error(
				{ err: error, durationMs: Date.now() - startedAt },
				"OppaiOracle tagging failed",
			);
			if (error instanceof ORPCError) throw error;
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new ORPCError("UNPROCESSABLE_CONTENT", {
				message: `OppaiOracle tagging failed: ${message}`,
			});
		}
	}),

	ccipFeature: os.ccipFeature.handler(async ({ input }) => {
		if ("file" in input) {
			const buffer = await input.file.arrayBuffer();
			return await taggingService.getCcipFeature(buffer);
		}

		const { mediaSourceId, mediaId } = input;
		if (!(mediaSourceId && mediaId)) {
			throw new Error("mediaSourceId and mediaId are required");
		}

		return await taggingService.getCcipFeatureForMedia(mediaSourceId, mediaId);
	}),

	ccipDifference: os.ccipDifference.handler(
		async ({ input }) =>
			await taggingService.getCcipDifference(input.feature1, input.feature2),
	),

	ccipDistances: os.ccipDistances.handler(async ({ input }) => ({
		distances: await taggingService.getCcipDistances(
			input.feature,
			input.candidates,
		),
	})),

	scanBatchTaggingTargets: os.scanBatchTaggingTargets.handler(
		async ({ input }) => ({ count: await countTaggingTargets(db, input) }),
	),

	startBatchTagging: os.startBatchTagging.handler(async ({ input }) => {
		const { mediaSourceId, force, batchSize } = input;
		const jobRepo = services.getJobRepository();

		const parentJob = await jobRepo.createBatch(
			{
				type: "bulk_tagging_parent",
				status: "in_progress",
				mediaSourceId,
				payload: {
					total: 0,
					processed: 0,
					failed: 0,
					mediaSourceId,
					force,
				},
			},
			{
				type: "bulk_tagging_dispatch",
				mediaSourceId,
				payload: {
					mediaSourceId,
					force,
					...(batchSize !== undefined ? { batchSize } : {}),
				},
			},
		);
		notifyBatchQueued(parentJob.id);

		logger.info(
			{
				jobId: parentJob.id,
				mediaSourceId,
				force: force ?? false,
			},
			"Batch tagging dispatch queued",
		);

		return {
			success: true,
			message: "Batch tagging dispatch queued",
			jobId: parentJob.id,
		};
	}),

	ccipVectorStatus: os.ccipVectorStatus.handler(async ({ input }) => {
		try {
			const status = await ccipVectorService.getStatus(
				input.mediaSourceId,
				input.mediaId,
			);
			const latestJob = await db.query.jobs.findFirst({
				where: {
					type: "extract_ccip_vector",
					mediaSourceId: input.mediaSourceId,
					RAW: (job) => sql`${job.payload}->>'mediaId' = ${input.mediaId}`,
				},
				orderBy: { createdAt: "desc" },
			});
			if (status.status === "ready" || status.status === "stale") {
				return status;
			}
			if (
				latestJob?.status === "pending" ||
				latestJob?.status === "in_progress"
			) {
				return { status: "processing" as const, jobId: latestJob.id };
			}
			if (latestJob?.status === "failed") {
				return {
					status: "failed" as const,
					jobId: latestJob.id,
					error: latestJob.error ?? "CCIP vector extraction failed",
				};
			}
			return status;
		} catch (error) {
			const isError = error instanceof Error;
			logger.error(
				{
					errorName: isError ? error.name : typeof error,
					errorMessage: isError ? error.message : String(error),
					errorStack: isError ? error.stack : undefined,
					mediaSourceId: input.mediaSourceId,
					mediaId: input.mediaId,
				},
				"CCIP vector status lookup failed",
			);
			throw error;
		}
	}),

	startCcipExtraction: os.startCcipExtraction.handler(async ({ input }) => {
		const job = await services.getJobRepository().create({
			type: "extract_ccip_vector",
			mediaSourceId: input.mediaSourceId,
			payload: { mediaId: input.mediaId, force: input.force },
		});
		logger.info(
			{
				jobId: job.id,
				mediaSourceId: input.mediaSourceId,
				mediaId: input.mediaId,
				force: input.force,
			},
			"CCIP vector extraction queued",
		);
		return {
			success: true,
			message: "CCIP vector extraction queued",
			jobId: job.id,
		};
	}),

	scanBatchCcipTargets: os.scanBatchCcipTargets.handler(async ({ input }) => ({
		count: await countCcipTargets(db, input),
	})),

	startBatchCcipExtraction: os.startBatchCcipExtraction.handler(
		async ({ input }) => {
			const { mediaSourceId, force } = input;
			const jobRepo = services.getJobRepository();
			const parent = await jobRepo.createBatch(
				{
					type: "batch_ccip_parent",
					status: "in_progress",
					mediaSourceId,
					payload: {
						total: 0,
						processed: 0,
						failed: 0,
						mediaSourceId,
						force,
					},
				},
				{
					type: "batch_ccip_dispatch",
					mediaSourceId,
					payload: { mediaSourceId, force },
				},
			);
			notifyBatchQueued(parent.id);
			logger.info(
				{
					jobId: parent.id,
					mediaSourceId,
					force: force ?? false,
				},
				"Batch CCIP dispatch queued",
			);
			return {
				success: true,
				message: "Batch CCIP dispatch queued",
				jobId: parent.id,
			};
		},
	),

	detectAndCropCharacters: os.detectAndCropCharacters.handler(
		async ({ input }) => {
			const startedAt = Date.now();
			const logContext =
				"file" in input
					? {
							inputType: "file",
							fileName: input.file.name,
							fileSize: input.file.size,
							transparent: input.transparent,
						}
					: {
							inputType: "media",
							mediaId: input.mediaId,
							transparent: input.transparent,
						};
			logger.info(logContext, "Character detection and cropping started");
			try {
				const transparent = input.transparent ?? false;

				const aiClient = services.getAiClient();
				const result =
					"file" in input
						? await aiClient.detectAndCropCharacters(input.file, transparent)
						: await aiClient.detectAndCropCharactersByPath(
								await resolveCharacterCropPath(input.mediaId),
								transparent,
							);
				logger.info(
					{
						...logContext,
						detectionCount: result.detections.length,
						durationMs: Date.now() - startedAt,
					},
					"Character detection and cropping completed",
				);
				return result;
			} catch (error) {
				logger.error(
					{
						err: error,
						...logContext,
						durationMs: Date.now() - startedAt,
					},
					"Character detection and cropping failed",
				);
				const message =
					error instanceof Error ? error.message : "Unknown error";
				throw new ORPCError("UNPROCESSABLE_CONTENT", {
					message: `Character detection and cropping failed: ${message}`,
				});
			}
		},
	),
});
