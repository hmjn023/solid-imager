import { BatchRunService } from "@solid-imager/application/services/batch-run-service";
import { getTaggingTaskRevision } from "@solid-imager/application/services/tagging-task-service";
import { getCcipTaskRevision } from "@solid-imager/application/services/ccip-vector-service";
import { getMediaTaskRevision } from "@solid-imager/application/services/media-task-service";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import {
	processingSettingsFromConfig,
	serializeMediaProcessingInput,
	type MediaProcessingInput,
	type MediaTaskKind,
} from "@solid-imager/core/domain/processing/schemas";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type { BatchInput } from "@solid-imager/core/domain/batches/schemas";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { BatchRunRepository } from "~/infrastructure/repositories/batch-run-repository";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { getExecutor } from "~/infrastructure/db/executor";
import { medias, mediaSources } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";
import { services } from "~/infrastructure/service-registry";
import { logger } from "~/infrastructure/logger";
import { taggingService } from "./tagging-service";
import { ccipVectorService } from "./ccip-vector-service";
import { scanTaggingTargetPage } from "~/infrastructure/jobs/tagging-targets";
import { scanCcipTargetPage } from "~/infrastructure/jobs/ccip-targets";
import { thumbnailExists } from "~/infrastructure/jobs/thumbnails";
import { MediaProcessingStateRepository } from "~/infrastructure/repositories/media-processing-state-repository";

function revisions() {
	const tagging = services.getAiClient().getTaggingSettings();
	const ccip = services.getAiClient().getCcipSettings();
	const file = processingSettingsFromConfig(
		services.getConfigService().getConfig(),
	);
	return {
		tagging,
		ccip,
		revision: (input: MediaProcessingInput, kind: MediaTaskKind) =>
			kind === "tagging"
				? getTaggingTaskRevision(input, tagging)
				: kind === "ccip"
					? getCcipTaskRevision(input, ccip)
					: getMediaTaskRevision(input, kind, file),
	};
}
export const batchRunService = new BatchRunService({
	repo: BatchRunRepository,
	transactions: DrizzleTransactionManager,
	logger,
	capture: (input: BatchInput) => {
		if (input.kind === "media")
			throw new Error("Mixed legacy media batches are read-only");
		const kind = input.kind;
		const settings = revisions();
		return async (cursor, tx) => {
			const db = getExecutor(tx);
			let ids: string[] | undefined = input.mediaIds;
			let nextCursor: string | undefined;
			if (!ids && kind !== "thumbnail") {
				const options = {
					mediaSourceId: input.mediaSourceId,
					force: input.force,
					limit: 100,
					afterId: cursor,
				};
				const page =
					kind === "tagging"
						? await scanTaggingTargetPage(options, db, settings.tagging)
						: await scanCcipTargetPage(options, db, settings.ccip, (ids) =>
								ccipVectorService.getMetadataMany(ids, tx),
							);
				ids = page.targets.map((target) => target.id);
				nextCursor = page.nextCursor;
			}
			const rows =
				ids?.length === 0
					? []
					: await db
							.select({ media: medias, source: mediaSources })
							.from(medias)
							.innerJoin(
								mediaSources,
								eq(mediaSources.id, medias.mediaSourceId),
							)
							.where(
								and(
									eq(mediaSources.type, "local"),
									input.mediaSourceId
										? eq(medias.mediaSourceId, input.mediaSourceId)
										: undefined,
									ids ? inArray(medias.id, ids) : undefined,
									cursor ? gt(medias.id, cursor) : undefined,
								),
							)
							.orderBy(asc(medias.id))
							.limit(100);
			if (input.mediaIds || kind === "thumbnail")
				nextCursor = rows.at(-1)?.media.id;
			const targets = [];
			for (const { media, source } of rows) {
				const connection = localConnectionSchema.safeParse(
					source.connectionInfo,
				);
				if (
					!connection.success ||
					(kind === "thumbnail"
						? media.mediaType === "audio"
						: media.mediaType !== "image")
				)
					continue;
				if (
					kind === "thumbnail" &&
					input.missingOnly &&
					(await thumbnailExists(source.id, media.id, input.thumbnailSize))
				)
					continue;
				const snapshot = {
					mediaId: media.id,
					mediaSourceId: media.mediaSourceId,
					sourcePath: connection.data.path,
					filePath: media.filePath,
					modifiedAt: media.modifiedAt,
					fileSize: media.fileSize,
					mediaType: media.mediaType,
				};
				targets.push({
					mediaId: media.id,
					mediaSourceId: source.id,
					kind: kind,
					input: { ...snapshot, modifiedAt: snapshot.modifiedAt.toISOString() },
					plannedRevision: settings.revision(snapshot, kind),
				});
			}
			return { targets, nextCursor };
		};
	},
	reserve: async (item, input, tx) => {
		if (!item.input || !item.plannedRevision) return null;
		const media = await services
			.getMediaRepository()
			.findById(item.mediaId, tx, { forUpdate: true });
		const source = await services
			.getSourceRepository()
			.findById(item.mediaSourceId, tx);
		const connection = localConnectionSchema.safeParse(source?.connectionInfo);
		if (
			!media ||
			media.mediaSourceId !== item.mediaSourceId ||
			source?.type !== "local" ||
			!connection.success
		)
			return null;
		const current = {
			mediaId: media.id,
			mediaSourceId: media.mediaSourceId,
			sourcePath: connection.data.path,
			filePath: media.filePath,
			modifiedAt: media.modifiedAt,
			fileSize: media.fileSize,
			mediaType: media.mediaType,
		};
		if (
			serializeMediaProcessingInput(current) !==
				serializeMediaProcessingInput({
					...item.input,
					modifiedAt: new Date(item.input.modifiedAt),
				}) ||
			revisions().revision(current, item.kind) !== item.plannedRevision
		)
			return null;
		try {
			if (item.requestId) {
				const previous = (
					await MediaProcessingStateRepository.findByMediaIds(
						[item.mediaId],
						tx,
					)
				).find((state) => state.taskKind === item.kind);
				if (
					previous?.status === "completed" &&
					previous.requestId === item.requestId &&
					previous.requestedRevision === item.plannedRevision
				)
					return previous;
			}
			if (item.kind === "tagging")
				return await taggingService.requestTags(
					item.mediaSourceId,
					item.mediaId,
					input.force || item.attemptCount > 0,
					tx,
					item.runId,
				);
			if (item.kind === "ccip")
				return await ccipVectorService.requestExtraction(
					item.mediaSourceId,
					item.mediaId,
					input.force || item.attemptCount > 0,
					tx,
					item.runId,
				);
			return await services
				.getMediaProcessingService()
				.requestTask(
					item.mediaSourceId,
					item.mediaId,
					item.kind,
					input.force || item.attemptCount > 0,
					tx,
					true,
					item.runId,
				);
		} catch (error) {
			if (error instanceof ResourceNotFoundError) return null;
			throw error;
		}
	},
	notify: ({ run, progress }, action) => {
		if (action === "retry")
			RealtimeEventBus.publishJob("job-retried", {
				jobId: run.id,
				message: "Batch remaining items queued",
			});
		else if (action === "cancel")
			RealtimeEventBus.publishJob("job-cancelled", {
				jobId: run.id,
				message: "Batch cancelled",
			});
		else if (run.status === "completed")
			RealtimeEventBus.publishJob("job-completed", {
				jobId: run.id,
				message: "Batch completed",
			});
		else if (run.status === "failed" || run.status === "blocked")
			RealtimeEventBus.publishJob("job-failed", {
				jobId: run.id,
				error: "Batch processing failed",
			});
		else
			RealtimeEventBus.publishJob("job-progress", {
				jobId: run.id,
				processed: progress.completed + progress.failed + progress.cancelled,
				total: progress.total,
			});
	},
});
