import type {
	FindPendingJobsOptions,
	JobRecord,
	JobRepositoryPort,
	NewJobRecord,
} from "@solid-imager/application/ports/job-repository";
import { and, asc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { jobs } from "../schema";
import type { DrizzleExecutor } from "../types";

export type JobRepositoryExecutorProvider = () => DrizzleExecutor;

const DEFAULT_INSERT_CHUNK_SIZE = 500;
const ACTIVE_JOB_STATUSES = ["pending", "in_progress"] as const;
const UNIQUE_JOB_LOCK_KEY = 0x4a4f4253;

function mapToJobRecord(row: typeof jobs.$inferSelect): JobRecord {
	return {
		id: row.id,
		type: row.type,
		mediaSourceId: row.mediaSourceId,
		status: row.status,
		payload: row.payload,
		result: row.result,
		error: row.error,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		parentId: row.parentId,
	};
}

function hasMediaIdPayload(value: unknown): value is { mediaId: string } {
	return (
		typeof value === "object" &&
		value !== null &&
		"mediaId" in value &&
		typeof value.mediaId === "string"
	);
}

function toInsertValue(job: NewJobRecord): typeof jobs.$inferInsert {
	return {
		...(job.id !== undefined ? { id: job.id } : {}),
		type: job.type,
		...(job.mediaSourceId !== undefined
			? { mediaSourceId: job.mediaSourceId }
			: {}),
		...(job.status !== undefined ? { status: job.status } : {}),
		...(job.payload !== undefined ? { payload: job.payload } : {}),
		...(job.result !== undefined ? { result: job.result } : {}),
		...(job.error !== undefined ? { error: job.error } : {}),
		...(job.createdAt !== undefined ? { createdAt: job.createdAt } : {}),
		...(job.updatedAt !== undefined ? { updatedAt: job.updatedAt } : {}),
		...(job.parentId !== undefined ? { parentId: job.parentId } : {}),
	};
}

function toUpdateValue(
	job: Partial<JobRecord>,
): Partial<typeof jobs.$inferInsert> {
	return {
		...(job.type !== undefined ? { type: job.type } : {}),
		...(job.mediaSourceId !== undefined
			? { mediaSourceId: job.mediaSourceId }
			: {}),
		...(job.status !== undefined ? { status: job.status } : {}),
		...(job.payload !== undefined ? { payload: job.payload } : {}),
		...(job.result !== undefined ? { result: job.result } : {}),
		...(job.error !== undefined ? { error: job.error } : {}),
		...(job.createdAt !== undefined ? { createdAt: job.createdAt } : {}),
		...(job.updatedAt !== undefined ? { updatedAt: job.updatedAt } : {}),
		...(job.parentId !== undefined ? { parentId: job.parentId } : {}),
	};
}

async function insertJob(
	executor: DrizzleExecutor,
	job: NewJobRecord,
): Promise<JobRecord> {
	const [created] = await executor
		.insert(jobs)
		.values(toInsertValue(job))
		.returning();
	return mapToJobRecord(created);
}

function getUniqueJobKey(job: NewJobRecord): string | null {
	const payload = job.payload;
	if (
		typeof payload !== "object" ||
		payload === null ||
		!("mediaId" in payload) ||
		typeof payload.mediaId !== "string"
	) {
		return null;
	}
	return `${job.type}:${payload.mediaId}`;
}

function getUniqueMediaId(job: NewJobRecord): string | null {
	const payload = job.payload;
	if (
		typeof payload !== "object" ||
		payload === null ||
		!("mediaId" in payload) ||
		typeof payload.mediaId !== "string"
	) {
		return null;
	}
	return payload.mediaId;
}

async function withUniqueJobLock<T>(
	executor: DrizzleExecutor,
	key: string,
	action: (executor: DrizzleExecutor) => Promise<T>,
): Promise<T> {
	if (hasTransaction(executor)) {
		return await executor.transaction(async (tx) => {
			await tx.execute(
				sql`SELECT pg_advisory_xact_lock(${UNIQUE_JOB_LOCK_KEY}, hashtext(${key}))`,
			);
			return await action(tx);
		});
	}

	await asSqlExecutor(executor).execute(
		sql`SELECT pg_advisory_xact_lock(${UNIQUE_JOB_LOCK_KEY}, hashtext(${key}))`,
	);
	return await action(executor);
}

function hasTransaction(
	executor: DrizzleExecutor,
): executor is Extract<DrizzleExecutor, { transaction: (...args: any[]) => any }> {
	return "transaction" in executor;
}

function asSqlExecutor(
	executor: DrizzleExecutor,
): { execute: (query: unknown) => Promise<unknown> } {
	return executor as { execute: (query: unknown) => Promise<unknown> };
}

export function createJobRepository(
	getExecutor: JobRepositoryExecutorProvider,
	options: { insertChunkSize?: number } = {},
): JobRepositoryPort {
	const insertChunkSize = options.insertChunkSize ?? DEFAULT_INSERT_CHUNK_SIZE;

	return {
		async create(job: NewJobRecord): Promise<JobRecord> {
			return await insertJob(getExecutor(), job);
		},

		async createMany(newJobs: NewJobRecord[]): Promise<JobRecord[]> {
			if (newJobs.length === 0) {
				return [];
			}

			const rows: JobRecord[] = [];
			for (let i = 0; i < newJobs.length; i += insertChunkSize) {
				const chunk = newJobs.slice(i, i + insertChunkSize);
				const inserted = await getExecutor()
					.insert(jobs)
					.values(chunk.map(toInsertValue))
					.returning();
				rows.push(...inserted.map(mapToJobRecord));
			}
			return rows;
		},

		async createIfUnique(job: NewJobRecord): Promise<JobRecord | null> {
			const uniqueKey = getUniqueJobKey(job);
			if (!uniqueKey) {
				return await insertJob(getExecutor(), job);
			}

			const mediaId = getUniqueMediaId(job);
			const executor = getExecutor();
			return await withUniqueJobLock(executor, uniqueKey, async (tx) => {
				const activeRows = await tx
					.select()
					.from(jobs)
					.where(
						and(
							eq(jobs.type, job.type),
							inArray(jobs.status, [...ACTIVE_JOB_STATUSES]),
						),
					);
				const existing = activeRows.find(
					(row) =>
						hasMediaIdPayload(row.payload) && row.payload.mediaId === mediaId,
				);
				if (existing) {
					return null;
				}

				return await insertJob(tx, job);
			});
		},

		async findById(id: string): Promise<JobRecord | null> {
			const rows = await getExecutor()
				.select()
				.from(jobs)
				.where(eq(jobs.id, id))
				.limit(1);
			return rows[0] ? mapToJobRecord(rows[0]) : null;
		},

		async findPending(
			limit: number,
			options: FindPendingJobsOptions = {},
		): Promise<JobRecord[]> {
			if (options.excludeTypes?.length && options.includeTypes?.length) {
				throw new Error(
					"Cannot use excludeTypes and includeTypes simultaneously.",
				);
			}

			const conditions = [
				eq(jobs.status, "pending"),
				ne(jobs.type, "import_request"),
			];

			if (options.excludeTypes?.length) {
				conditions.push(notInArray(jobs.type, options.excludeTypes));
			}

			if (options.includeTypes?.length) {
				conditions.push(inArray(jobs.type, options.includeTypes));
			}

			const rows = await getExecutor()
				.select()
				.from(jobs)
				.where(and(...conditions))
				.orderBy(asc(jobs.createdAt))
				.limit(limit);
			return rows.map(mapToJobRecord);
		},

		async resetInProgressToPending(
			resetOptions: { includeTypes?: string[] } = {},
		): Promise<void> {
			const conditions = [eq(jobs.status, "in_progress")];
			if (resetOptions.includeTypes?.length) {
				conditions.push(inArray(jobs.type, resetOptions.includeTypes));
			} else {
				conditions.push(ne(jobs.type, "import_request"));
			}

			await getExecutor()
				.update(jobs)
				.set({
					status: "pending",
					updatedAt: new Date(),
				})
				.where(and(...conditions));
		},

		async markAsInProgress(id: string): Promise<void> {
			await getExecutor()
				.update(jobs)
				.set({
					status: "in_progress",
					error: null,
					updatedAt: new Date(),
				})
				.where(eq(jobs.id, id));
		},

		async markAsCompleted(id: string, result?: unknown): Promise<void> {
			await getExecutor()
				.update(jobs)
				.set({
					status: "completed",
					result,
					error: null,
					updatedAt: new Date(),
				})
				.where(eq(jobs.id, id));
		},

		async markAsFailed(id: string, error: string): Promise<void> {
			await getExecutor()
				.update(jobs)
				.set({
					status: "failed",
					error,
					updatedAt: new Date(),
				})
				.where(eq(jobs.id, id));
		},

		async update(id: string, data: Partial<JobRecord>): Promise<void> {
			await getExecutor()
				.update(jobs)
				.set(toUpdateValue(data))
				.where(eq(jobs.id, id));
		},

		async incrementProgress(id: string): Promise<void> {
			await getExecutor().execute(
				sql`UPDATE ${jobs} SET payload = jsonb_set(payload, '{processed}', (COALESCE(payload->>'processed', '0')::int + 1)::text::jsonb) WHERE id = ${id}`,
			);
		},
	};
}
