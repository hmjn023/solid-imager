import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import {
	beforeAll,
	beforeEach,
	afterEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { eq, inArray } from "drizzle-orm";
import type {
	MediaProcessingInput,
	MediaTaskKind,
	ProcessingRecoveryRequest,
	ProcessingRecoveryResponse,
} from "@solid-imager/core/domain/processing/schemas";
import { processingSettingsFromConfig } from "@solid-imager/core/domain/processing/schemas";
import { getMediaTaskRevision } from "@solid-imager/application/services/media-task-service";
import { getTaggingTaskRevision } from "@solid-imager/application/services/tagging-task-service";
import { getCcipTaskRevision } from "@solid-imager/application/services/ccip-vector-service";
import { db } from "~/infrastructure/db";
import {
	batchRuns,
	batchItems,
	mediaSources,
	mediaProcessingStates,
	jobs,
} from "~/infrastructure/db/schema";
import { services } from "~/infrastructure/service-registry";
import { processingRouter } from "~/infrastructure/api/routers/processing-router";
import { batchRunService } from "~/infrastructure/services/batch-run-service";
import { BatchRunRepository } from "~/infrastructure/repositories/batch-run-repository";
import { MediaProcessingStateRepository as states } from "~/infrastructure/repositories/media-processing-state-repository";
import { DrizzleTransactionManager as transactions } from "~/infrastructure/db/transaction-manager";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";
import { getCcipVectorService } from "~/infrastructure/services/ccip-vector-service";

describe("bounded unfinished processing detection and recovery", () => {
	const client = createRouterClient(processingRouter);
	let sourceId: string;
	let directory: string;
	const tagging = {
		model: "test-model",
		modelVersion: "v1",
		runtimeVersion: "test-v1",
		provider: "test",
		device: null,
		endpoint: "",
	};
	const ccip = { ...tagging, embeddingVersion: 1, dimensions: 768 };
	beforeAll(async () => {
		await services.getJobWorker().stop();
		await services.getMediaAiWorker().stop();
		await services.getMediaFileWorker().stop();
		await batchRunService.initialize();
	});
	beforeEach(async () => {
		directory = await mkdtemp(path.join(tmpdir(), "processing-recovery-"));
		const config = services.getConfigService().getConfig();
		vi.spyOn(services.getConfigService(), "getConfig").mockReturnValue({
			...config,
			storage: { ...config.storage, thumbnailDir: directory },
		});
		vi.spyOn(services.getAiClient(), "getTaggingSettings").mockReturnValue(
			tagging,
		);
		vi.spyOn(services.getAiClient(), "getCcipSettings").mockReturnValue(ccip);
		sourceId = (
			await services.getSourceRepository().create({
				name: "Recovery fixture",
				description: null,
				type: "local",
				connectionInfo: { path: directory },
			})
		).id;
	});
	afterEach(async () => {
		vi.restoreAllMocks();
		// This file owns its isolated PGlite fixture and all batches created within it.
		await db.delete(batchRuns);
		await db.delete(mediaSources).where(eq(mediaSources.id, sourceId));
		await rm(directory, { recursive: true, force: true });
	});
	async function media(
		name = `${randomUUID()}.png`,
		mediaType: "image" | "video" | "audio" = "image",
	) {
		return services.getMediaRepository().create({
			mediaSourceId: sourceId,
			filePath: name,
			fileName: name,
			mediaType,
			fileSize: 42,
			width: 16,
			height: 16,
			description: null,
			createdAt: new Date("2026-01-01"),
			modifiedAt: new Date("2026-01-01"),
		});
	}
	async function state(
		mediaId: string,
		kind: MediaTaskKind,
		status: "pending" | "completed" | "failed",
		options: { old?: boolean; abandoned?: boolean } = {},
	) {
		const media = await services.getMediaRepository().findById(mediaId);
		if (!media) throw new Error("Missing media");
		const input: MediaProcessingInput = {
			mediaId,
			mediaSourceId: sourceId,
			filePath: media.filePath,
			sourcePath: directory,
			mediaType: media.mediaType,
			fileSize: media.fileSize,
			modifiedAt: media.modifiedAt,
		};
		const revision = options.old
			? "old"
			: kind === "tagging"
				? getTaggingTaskRevision(
						input,
						services.getAiClient().getTaggingSettings(),
					)
				: kind === "ccip"
					? getCcipTaskRevision(input, services.getAiClient().getCcipSettings())
					: getMediaTaskRevision(
							input,
							kind,
							processingSettingsFromConfig(
								services.getConfigService().getConfig(),
							),
						);
		const request = await transactions.transaction((tx) =>
			states.request(
				{
					input,
					taskKind: kind,
					revision,
					maxAttempts: 5,
					force: true,
					...(options.abandoned ? { batchId: randomUUID() } : {}),
				},
				tx,
			),
		);
		if (status !== "pending")
			await db
				.update(mediaProcessingStates)
				.set({
					status,
					completedRevision: status === "completed" ? revision : null,
				})
				.where(eq(mediaProcessingStates.requestId, request.requestId));
		return request;
	}
	it("detects missing, failed, outdated and abandoned metadata while preserving completed and queued work", async () => {
		const missing = await media("missing.png"),
			failed = await media("failed.png"),
			old = await media("old.png"),
			abandoned = await media("abandoned.png"),
			lost = await media("lost-output.png"),
			done = await media("empty-but-valid.png"),
			pending = await media("pending.png"),
			queued = await media("queued.png");
		await media("audio.mp3", "audio");
		await state(failed.id, "metadata", "failed");
		await state(old.id, "metadata", "completed", { old: true });
		await state(abandoned.id, "metadata", "pending", { abandoned: true });
		await state(lost.id, "metadata", "completed");
		await state(done.id, "metadata", "completed");
		await services
			.getMediaRepository()
			.upsertGenerationInfo(done.id, null, null);
		await state(pending.id, "metadata", "pending");
		await batchRunService.start({
			kind: "metadata",
			mediaSourceId: sourceId,
			mediaIds: [queued.id],
			force: false,
			missingOnly: false,
			thumbnailSize: 512,
		});
		const unrequested = await client.list({
			status: "not_requested",
			kind: "metadata",
			mediaSourceId: sourceId,
			limit: 1,
			offset: 0,
		});
		expect(unrequested.total).toBe(2);
		expect(unrequested.items).toHaveLength(1);
		const scan = await client.scanRecovery({
			kind: "metadata",
			mediaSourceId: sourceId,
		});
		expect(scan.scanned).toBe(8);
		expect(
			new Map(scan.items.map((item) => [item.mediaId, item.reason])),
		).toEqual(
			new Map([
				[missing.id, "not_requested"],
				[failed.id, "failed"],
				[old.id, "outdated"],
				[abandoned.id, "abandoned"],
				[lost.id, "missing_output"],
			]),
		);
		const before = await states.findByMediaIds([done.id, pending.id]);
		const result = await client.enqueueRecovery({
			kind: "metadata",
			mediaSourceId: sourceId,
		});
		expect(result.queued).toBe(5);
		expect(result.jobId).not.toBeNull();
		expect(await states.findByMediaIds([done.id, pending.id])).toEqual(before);
		const claims = await BatchRunRepository.claimPending(10);
		for (const claim of claims) await batchRunService.dispatch(claim);
		const recovered = await states.findByMediaIds([
			missing.id,
			failed.id,
			old.id,
			abandoned.id,
			lost.id,
		]);
		expect(recovered).toHaveLength(5);
		expect(
			recovered.every(
				(row) => row.status === "pending" && row.executionMode === "scheduled",
			),
		).toBe(true);
		expect(await db.select().from(jobs)).toHaveLength(0);
	});
	it("finds and queues more than 200 missing targets without losing keyset pages as batches are created", async () => {
		for (let index = 0; index < 251; index++) await media(`bulk-${index}.png`);
		let cursor: ProcessingRecoveryRequest["cursor"];
		let queued = 0;
		const runIds: string[] = [];
		do {
			const page = await client.enqueueRecovery({
				kind: "metadata",
				mediaSourceId: sourceId,
				query: "bulk-",
				cursor,
			});
			expect(page.scanned).toBeLessThanOrEqual(100);
			expect(page.queued).toBeLessThanOrEqual(100);
			queued += page.queued;
			if (page.jobId) runIds.push(page.jobId);
			cursor = page.cursor ?? undefined;
		} while (cursor);
		expect(queued).toBe(251);
		expect(runIds).toHaveLength(3);
		expect(
			await db
				.select()
				.from(batchItems)
				.where(inArray(batchItems.runId, runIds)),
		).toHaveLength(251);
		const scans: ProcessingRecoveryResponse[] = [];
		do {
			const page = await client.scanRecovery({
				kind: "metadata",
				mediaSourceId: sourceId,
				cursor,
			});
			scans.push(page);
			cursor = page.cursor ?? undefined;
		} while (cursor);
		expect(scans.reduce((sum, page) => sum + page.items.length, 0)).toBe(0);
	});
	it.each(["", "https://ai.example.test"])(
		"checks both thumbnail sizes and preserves valid empty tagging results at endpoint %s",
		async (endpoint) => {
			vi.mocked(services.getAiClient().getTaggingSettings).mockReturnValue({
				...tagging,
				endpoint,
			});
			const image = await media();
			await media("movie.mp4", "video");
			await media("audio.mp3", "audio");
			await state(image.id, "thumbnail", "completed");
			const large = getThumbnailPath(sourceId, image.id, 512);
			await mkdir(path.dirname(large), { recursive: true });
			await writeFile(large, "fixture");
			expect(
				(
					await client.scanRecovery({
						kind: "thumbnail",
						mediaSourceId: sourceId,
					})
				).items.find((item) => item.mediaId === image.id)?.reason,
			).toBe("missing_output");
			const small = getThumbnailPath(sourceId, image.id, 256);
			await mkdir(path.dirname(small), { recursive: true });
			await writeFile(small, "fixture");
			const thumbnails = await client.scanRecovery({
				kind: "thumbnail",
				mediaSourceId: sourceId,
			});
			expect(thumbnails.scanned).toBe(2);
			expect(thumbnails.items.some((item) => item.mediaId === image.id)).toBe(
				false,
			);
			const tags = await state(image.id, "tagging", "completed");
			await db
				.update(mediaProcessingStates)
				.set({
					taggingResult: {
						general: {},
						character: {},
						attributes: {},
						ips: [],
						ips_mapping: {},
					},
				})
				.where(eq(mediaProcessingStates.requestId, tags.requestId));
			expect(
				(
					await client.scanRecovery({
						kind: "tagging",
						mediaSourceId: sourceId,
					})
				).items,
			).toHaveLength(0);
			await db
				.update(mediaProcessingStates)
				.set({ taggingResult: null })
				.where(eq(mediaProcessingStates.requestId, tags.requestId));
			expect(
				(
					await client.scanRecovery({
						kind: "tagging",
						mediaSourceId: sourceId,
					})
				).items[0].reason,
			).toBe("missing_output");
		},
	);
	it("keeps source and literal filename scope and excludes media inserted after the first page", async () => {
		for (let index = 0; index < 101; index++)
			await media(`literal_%_${index}.png`);
		await media("literal-ab-0.png");
		const first = await client.scanRecovery({
			kind: "metadata",
			mediaSourceId: sourceId,
			query: "literal_%_",
		});
		expect(first.scanned).toBe(100);
		expect(first.cursor).not.toBeNull();
		const later = await media("literal_%_later.png");
		const second = await client.scanRecovery({
			kind: "metadata",
			mediaSourceId: sourceId,
			query: "literal_%_",
			cursor: first.cursor ?? undefined,
		});
		expect(second.scanned).toBe(1);
		expect(second.cursor).toBeNull();
		expect(
			[...first.items, ...second.items].some(
				(item) => item.mediaId === later.id,
			),
		).toBe(false);
		expect(
			(
				await client.scanRecovery({
					kind: "metadata",
					mediaSourceId: randomUUID(),
				})
			).scanned,
		).toBe(0);
	});
	it("rechecks a completed target at capture instead of scheduling an obsolete scan result", async () => {
		const target = await media();
		expect(
			(await client.scanRecovery({ kind: "metadata", mediaSourceId: sourceId }))
				.items,
		).toHaveLength(1);
		await state(target.id, "metadata", "completed");
		await services
			.getMediaRepository()
			.upsertGenerationInfo(target.id, null, null);
		const batch = await batchRunService.start({
			kind: "metadata",
			mediaIds: [target.id],
			recovery: true,
			force: false,
			missingOnly: false,
			thumbnailSize: 512,
		});
		expect(batch.progress.total).toBe(0);
		expect(
			await db
				.select()
				.from(batchItems)
				.where(eq(batchItems.runId, batch.run.id)),
		).toHaveLength(0);
	});
	it("detects a missing CCIP output without invoking inference", async () => {
		const image = await media();
		const current = await state(image.id, "ccip", "completed");
		const output = vi
			.spyOn(getCcipVectorService(), "getMetadataMany")
			.mockResolvedValue(new Map());
		expect(
			(await client.scanRecovery({ kind: "ccip", mediaSourceId: sourceId }))
				.items[0].reason,
		).toBe("missing_output");
		output.mockResolvedValue(
			new Map([
				[
					image.id,
					{
						mediaId: image.id,
						mediaSourceId: sourceId,
						model: ccip.model,
						embeddingVersion: 1,
						processingRevision: current.requestedRevision,
						mediaModifiedAt: image.modifiedAt,
						extractedAt: new Date(),
					},
				],
			]),
		);
		expect(
			(await client.scanRecovery({ kind: "ccip", mediaSourceId: sourceId }))
				.items,
		).toHaveLength(0);
	});
});
