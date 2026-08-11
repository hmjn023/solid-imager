import { eventIterator, ORPCError, os } from "@orpc/server";
import {
	jobDtoSchema,
	jobIdRequestSchema,
	jobListRequestSchema,
	jobListResponseSchema,
	jobStatusSchema,
} from "@solid-imager/core/domain/jobs/schemas";
import {
	type JobEvent,
	jobEventSchema,
} from "@solid-imager/core/domain/sources/events";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";

type JobRow = typeof jobs.$inferSelect;
const PublicJobFailureMessage = "Job failed";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonNegativeInteger(value: unknown): number | undefined {
	return typeof value === "number" && Number.isInteger(value) && value >= 0
		? value
		: undefined;
}

function readTargetMediaId(payload: unknown): string | null {
	if (!isRecord(payload)) {
		return null;
	}
	const result = z.string().uuid().safeParse(payload.mediaId);
	return result.success ? result.data : null;
}

function readProgress(payload: unknown) {
	if (!isRecord(payload)) {
		return null;
	}
	const processed = readNonNegativeInteger(payload.processed);
	const total = readNonNegativeInteger(payload.total);
	if (processed === undefined || total === undefined) {
		return null;
	}
	return {
		processed,
		failed: readNonNegativeInteger(payload.failed) ?? 0,
		total,
	};
}

function toJobDto(job: JobRow) {
	return {
		id: job.id,
		type: job.type,
		mediaSourceId: job.mediaSourceId,
		status: jobStatusSchema.parse(job.status),
		createdAt: job.createdAt,
		updatedAt: job.updatedAt,
		parentId: job.parentId,
		error: job.error === null ? null : PublicJobFailureMessage,
		targetMediaId: readTargetMediaId(job.payload),
		progress: readProgress(job.payload),
	};
}

function jobWhere(status?: z.infer<typeof jobStatusSchema>) {
	return status ? and(eq(jobs.status, status)) : undefined;
}

export const jobsRouter = {
	list: os
		.input(jobListRequestSchema)
		.output(jobListResponseSchema)
		.handler(async ({ input }) => {
			const where = jobWhere(input.status);
			const [rows, totalRows] = await Promise.all([
				db
					.select()
					.from(jobs)
					.where(where)
					.orderBy(desc(jobs.createdAt), desc(jobs.id))
					.limit(input.limit)
					.offset(input.offset),
				db.select({ total: count() }).from(jobs).where(where),
			]);

			return {
				items: rows.map(toJobDto),
				total: Number(totalRows[0]?.total ?? 0),
			};
		}),

	get: os
		.input(jobIdRequestSchema)
		.output(jobDtoSchema)
		.handler(async ({ input }) => {
			const [job] = await db.select().from(jobs).where(eq(jobs.id, input.id));
			if (!job) {
				throw new ORPCError("NOT_FOUND", { message: "Job not found" });
			}
			return toJobDto(job);
		}),

	retry: os
		.input(jobIdRequestSchema)
		.output(jobDtoSchema)
		.handler(async ({ input }) => {
			const [requeued] = await db
				.update(jobs)
				.set({
					status: "pending",
					error: null,
					result: null,
					updatedAt: new Date(),
				})
				.where(and(eq(jobs.id, input.id), eq(jobs.status, "failed")))
				.returning();
			if (!requeued) {
				const [current] = await db
					.select({ id: jobs.id })
					.from(jobs)
					.where(eq(jobs.id, input.id));
				if (!current) {
					throw new ORPCError("NOT_FOUND", { message: "Job not found" });
				}
				throw new ORPCError("BAD_REQUEST", {
					message: "Only failed jobs can be retried",
				});
			}
			RealtimeEventBus.publishJob("job-retried", {
				jobId: requeued.id,
				message: "Job queued for retry",
			});
			return toJobDto(requeued);
		}),

	events: os.output(eventIterator(jobEventSchema)).handler(async function* ({
		signal,
	}) {
		const queue: JobEvent[] = [];
		let resolve: (() => void) | null = null;

		const unsubscribe = RealtimeEventBus.subscribeToJobs((event) => {
			queue.push(event);
			resolve?.();
			resolve = null;
		});

		try {
			while (!signal?.aborted) {
				if (queue.length === 0) {
					if (signal?.aborted) {
						break;
					}
					await new Promise<void>((done) => {
						if (signal?.aborted) {
							done();
							return;
						}
						const onAbort = () => {
							done();
						};
						signal?.addEventListener("abort", onAbort, { once: true });
						resolve = () => {
							signal?.removeEventListener("abort", onAbort);
							done();
						};
					});
				}

				while (queue.length > 0) {
					const event = queue.shift();
					if (event) {
						yield event;
					}
				}
			}
		} finally {
			unsubscribe();
		}
	}),
};
