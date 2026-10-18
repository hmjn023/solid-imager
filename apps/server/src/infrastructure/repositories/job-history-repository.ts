import { eq, inArray, or, sql } from "drizzle-orm";
import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
import { getExecutor } from "~/infrastructure/db/executor";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import {
	batchRuns,
	batchItems,
	downloadRuns,
	sourceSyncRuns,
	sourceTransferRuns,
	jobHistoryDismissals,
} from "~/infrastructure/db/schema";
import { BatchRunRepository } from "./batch-run-repository";

/** Only hides terminal execution owners. Never deletes work or its durable outcomes. */
export async function dismissJobHistory(id: string) {
	await DrizzleTransactionManager.transaction(async (tx) => {
		const db = getExecutor(tx);
		const [item] = await db
			.select({ runId: batchItems.runId })
			.from(batchItems)
			.where(eq(batchItems.id, id));
		const ownerId = item?.runId ?? id;
		let status: string | undefined;
		for (const table of [
			batchRuns,
			downloadRuns,
			sourceSyncRuns,
			sourceTransferRuns,
		]) {
			const [row] = await db
				.select({ id: table.id, status: table.status })
				.from(table)
				.where(eq(table.id, ownerId))
				.for("no key update");
			if (!row) continue;
			status =
				table === batchRuns
					? (await BatchRunRepository.findById(ownerId, tx))?.run.status
					: row.status;
			break;
		}
		if (!status) throw new ResourceNotFoundError("Job", id);
		if (status === "pending" || status === "in_progress")
			throw new ResourceConflictError(
				"Cancel the job or batch before deleting its history",
			);
		await db
			.insert(jobHistoryDismissals)
			.values({
				id: ownerId,
				dismissedAt: sql`timezone('UTC', clock_timestamp())`,
			})
			.onConflictDoNothing();
	});
}

export async function isJobHistoryDismissed(job: JobDto) {
	const [row] = await getExecutor()
		.select({ id: jobHistoryDismissals.id })
		.from(jobHistoryDismissals)
		.where(
			inArray(jobHistoryDismissals.id, [
				job.id,
				...(job.parentId ? [job.parentId] : []),
			]),
		)
		.limit(1);
	return !!row;
}

/** An explicit retry restores visibility even when invoked from an older open page. */
export async function restoreJobHistory(job: Pick<JobDto, "id" | "parentId">) {
	await getExecutor()
		.delete(jobHistoryDismissals)
		.where(
			or(
				eq(jobHistoryDismissals.id, job.id),
				job.parentId ? eq(jobHistoryDismissals.id, job.parentId) : undefined,
			),
		);
}
