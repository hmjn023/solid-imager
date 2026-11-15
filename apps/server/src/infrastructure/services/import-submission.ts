import { notifyBatchState } from "~/infrastructure/events/batch-state";
import { logger } from "~/infrastructure/logger";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { createImportBatch, sealImportScan } from "@solid-imager/db";
import { readImportBatch, type ImportWorkOwner } from "@solid-imager/core/jobs";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";
import { getExecutor } from "~/infrastructure/db/executor";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { JobRepository } from "~/infrastructure/db/repositories";
import { notifyJob } from "~/infrastructure/events/state-notifications";

type SubmissionType = "import_upload" | "import_register";

export async function reserveImportFiles(
	sourceId: string,
	labels: string[],
	type: SubmissionType,
	scanId?: string,
) {
	const reservations = labels.map(() => crypto.randomUUID());
	const batch = await DrizzleTransactionManager.transaction((tx) =>
		createImportBatch(
			getExecutor(tx),
			sourceId,
			labels.map((label, i) => ({
				label: path.win32.basename(label),
				work: { type, id: reservations[i] },
			})),
			scanId,
		),
	);
	if (!scanId)
		notifyJob("job-progress", {
			jobId: batch.id,
			processed: 0,
			total: labels.length,
		});
	return { jobId: batch.id, reservations };
}

export async function runImportSubmission<T>(
	sourceId: string,
	id: string,
	type: SubmissionType,
	submit: (owner: ImportWorkOwner) => Promise<T>,
) {
	const [reservation] = await db
		.update(jobs)
		.set({
			status: "in_progress",
			attemptCount: sql`attempt_count + 1`,
			startedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(jobs.id, id),
				eq(jobs.type, type),
				eq(jobs.mediaSourceId, sourceId),
				eq(jobs.status, "pending"),
			),
		)
		.returning();
	const context = reservation && readImportBatch(reservation);
	if (!context) throw new Error("Import reservation unavailable");
	const owner = { ...context, workId: id, attempt: reservation.attemptCount };
	// A large upload may spend hours sending files from its reserved list.
	// Renew the root while any client is still actively using its reservations.
	const renew = async () => {
		const now = new Date();
		await JobRepository.update(id, { updatedAt: now }, owner.attempt);
		await db
			.update(jobs)
			.set({ updatedAt: now })
			.where(
				and(
					eq(jobs.id, context.importBatchId),
					eq(jobs.status, "in_progress"),
					sql`updated_at < ${new Date(now.getTime() - 60_000).toISOString()}::timestamp`,
				),
			);
	};
	const heartbeat = setInterval(
		() => {
			void renew().catch((err) =>
				logger.error({ err, jobId: id }, "Failed to renew import reservation"),
			);
		},
		5 * 60 * 1000,
	);
	let result: T;
	try {
		await renew();
		result = await submit(owner);
	} catch (error) {
		const status = await JobRepository.finishAttempt(id, owner.attempt, {
			status: "failed",
			error: "Import submission failed",
		});
		if (status) await notifyBatchState(JobRepository, context.importBatchId);
		throw error;
	} finally {
		clearInterval(heartbeat);
	}
	const status = await JobRepository.finishAttempt(id, owner.attempt, {
		status: "completed",
		result:
			result &&
			typeof result === "object" &&
			"success" in result &&
			result.success === false
				? { skipped: true }
				: null,
	});
	if (status !== "completed")
		throw new Error("Import reservation no longer active");
	await notifyBatchState(JobRepository, context.importBatchId);
	return result;
}

export async function finishDirectoryImport(id: string, interrupted = false) {
	await sealImportScan(db, eq(jobs.id, id), interrupted);
	await notifyBatchState(JobRepository, id);
}
