import path from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
	importWorkOwner,
	readImportBatch,
	type Job,
} from "@solid-imager/core/jobs";
import {
	uploadMediaRequestSchema,
	type UploadMediaRequest,
} from "@solid-imager/core/media";
import { localConnectionSchema } from "@solid-imager/core/sources";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";
import {
	DrizzleSourceRepository,
	JobRepository,
	MediaRepository,
} from "~/infrastructure/db/repositories";
import { notifyBatchState } from "~/infrastructure/events/batch-state";
import { runImportSubmission } from "./import-submission";
import {
	getInputPath,
	JobArtifactTtlMs,
	persistJobInput,
	removeJobTransferFile,
} from "./job-transfer-storage";
import { MediaProcessingService } from "./media-processing-service";
import { MediaService } from "./media-service";

const uploadInputSchema = z.object({
	attempt: z.number().int().positive(),
	expiresAt: z.number(),
	name: z.string(),
	mime: z.string(),
	options: uploadMediaRequestSchema,
});
const retryPayload = z.object({
	relativePath: z.string().optional(),
	uploadInput: uploadInputSchema.optional(),
});
const inputKey = (id: string, attempt: number) => `${id}-${attempt}`;

export async function isUploadBatchCancelled(sourceId: string, id: string) {
	const job = await JobRepository.findById(id);
	if (
		job?.mediaSourceId !== sourceId ||
		job.type !== "import_upload" ||
		job.status !== "cancelled"
	)
		return false;
	const batch = readImportBatch(job);
	return !!(
		batch &&
		(await JobRepository.findById(batch.importBatchId))?.cancelRequestedAt
	);
}

/** Keep a disk-backed input until this upload is committed or transfer storage expires. */
export async function submitBatchUpload(
	sourceId: string,
	id: string,
	file: File,
	options: UploadMediaRequest,
) {
	let storedPath: string | undefined;
	const result = await runImportSubmission(
		sourceId,
		id,
		"import_upload",
		async (owner, payload) => {
			const previous = retryPayload.parse(payload).uploadInput;
			const originalOptions = previous?.options ?? {
				...options,
				filename: options.filename ?? file.name,
			};
			const input = {
				attempt: owner.attempt,
				expiresAt: Date.now() + JobArtifactTtlMs,
				name: file.name,
				mime: file.type,
				options: originalOptions,
			};
			storedPath = await persistJobInput(
				inputKey(id, owner.attempt),
				"upload",
				file,
			);
			await db
				.update(jobs)
				.set({
					payload: sql`payload || jsonb_build_object('uploadInput',${JSON.stringify(input)}::jsonb)`,
				})
				.where(
					and(
						eq(jobs.id, id),
						eq(jobs.attemptCount, owner.attempt),
						eq(jobs.status, "in_progress"),
						isNull(jobs.cancelRequestedAt),
					),
				);
			if (await JobRepository.isCancellationRequested(id))
				throw new Error("Upload cancelled");
			return MediaService.uploadMedia(sourceId, file, originalOptions, owner);
		},
	);
	if (storedPath) await removeJobTransferFile(storedPath);
	return result;
}

export async function replayImportSubmission(job: Job) {
	const owner = importWorkOwner(job);
	if (!owner || !job.mediaSourceId) throw new Error("Missing import target");
	const payload = retryPayload.parse(job.payload);
	if (job.type === "import_register") {
		const source = await DrizzleSourceRepository.findById(job.mediaSourceId);
		if (source?.type !== "local")
			throw new Error("Local import source unavailable");
		const basePath = localConnectionSchema.parse(source.connectionInfo).path;
		let relativePath = payload.relativePath;
		if (!relativePath) {
			// Older scan reservations stored only the basename. Resolve it only if unique.
			const target = await JobRepository.findById(owner.importTargetId);
			const { label } = z.object({ label: z.string() }).parse(target?.payload);
			const { scanFiles } = await import("./directory-sync-service");
			for await (const candidate of scanFiles(basePath)) {
				if (path.basename(candidate) !== label) continue;
				if (relativePath)
					throw new Error("Ambiguous file in legacy directory import");
				relativePath = candidate;
			}
		}
		if (!relativePath) throw new Error("Import file unavailable");
		const existing = await MediaRepository.findByPath(source.id, relativePath);
		if (existing) {
			await JobRepository.createIfUnique(
				{
					type: "processMedia",
					mediaSourceId: source.id,
					payload: { mediaId: existing.id, sourcePath: basePath },
				},
				owner,
			);
		} else
			await MediaProcessingService.registerAndProcess(
				source.id,
				relativePath,
				undefined,
				owner,
			);
		return;
	}
	if (!payload.uploadInput) throw new Error("Upload input unavailable");
	const input = payload.uploadInput;
	const blob = Bun.file(
		getInputPath(inputKey(job.id, input.attempt), "upload"),
	);
	if (!(await blob.exists())) {
		// Storage may have expired since the retry was queued. Hand this work back
		// to the uploader without releasing the batch's preparation barrier.
		await db
			.update(jobs)
			.set({
				status: "pending",
				startedAt: null,
				updatedAt: new Date(),
				payload: sql`payload || '{"awaitingFile":true}'::jsonb`,
			})
			.where(
				and(
					eq(jobs.id, job.id),
					eq(jobs.status, "in_progress"),
					eq(jobs.attemptCount, owner.attempt),
					isNull(jobs.cancelRequestedAt),
				),
			);
		await notifyBatchState(JobRepository, owner.importBatchId);
		return;
	}
	const result = await MediaService.uploadMedia(
		job.mediaSourceId,
		new File([blob], input.name, { type: input.mime }),
		input.options,
		owner,
	);
	return { skipped: !result.success };
}

export async function cleanupReplayedUpload(job: Job) {
	const input = retryPayload.safeParse(job.payload);
	if (input.success && input.data.uploadInput)
		await removeJobTransferFile(
			getInputPath(inputKey(job.id, input.data.uploadInput.attempt), "upload"),
		);
}
