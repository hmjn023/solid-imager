import { and, asc, eq, inArray } from "drizzle-orm";
import { downloadItemSchema } from "@solid-imager/core/media";
import { getExecutor } from "~/infrastructure/db/executor";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { jobs } from "~/infrastructure/db/schema";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";

/** The receipt owns approval. Its lock covers queue insertion and submission confirmation. */
export async function processImportRequests(
	jobIds: string[],
	targetSourceId: string,
): Promise<number> {
	if (jobIds.length === 0) return 0;
	return DrizzleTransactionManager.transaction(async (transaction) => {
		const executor = getExecutor(transaction);
		const pending = await executor
			.select()
			.from(jobs)
			.where(
				and(
					inArray(jobs.id, jobIds),
					eq(jobs.type, "import_request"),
					eq(jobs.status, "pending"),
				),
			)
			.orderBy(asc(jobs.id))
			.for("update");
		if (pending.length === 0) return 0;
		await queueDownloadJobs(
			targetSourceId,
			pending.map((job) => downloadItemSchema.parse(job.payload)),
			{
				transaction,
				requestIds: pending.map((job) => job.id),
			},
		);
		await executor
			.update(jobs)
			.set({
				status: "completed",
				mediaSourceId: targetSourceId,
				result: { status: "submitted", targetSourceId },
				finishedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(
				and(
					inArray(
						jobs.id,
						pending.map((job) => job.id),
					),
					eq(jobs.type, "import_request"),
					eq(jobs.status, "pending"),
				),
			);
		return pending.length;
	});
}

/** A concurrent approval either commits first or makes this pending-only delete ineligible. */
export async function cancelImportRequests(
	jobIds: string[],
): Promise<string[]> {
	if (jobIds.length === 0) return [];
	const removed = await getExecutor()
		.delete(jobs)
		.where(
			and(
				inArray(jobs.id, jobIds),
				eq(jobs.type, "import_request"),
				eq(jobs.status, "pending"),
			),
		)
		.returning();
	return removed.map((job) => job.id);
}
