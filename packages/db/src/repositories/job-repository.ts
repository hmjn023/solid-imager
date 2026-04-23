import type {
	FindPendingJobsOptions,
	JobRecord,
	JobRepositoryPort,
	NewJobRecord,
} from "@solid-imager/application/ports/job-repository";
import { and, asc, eq, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { jobs } from "../schema";
import type { DrizzleExecutor } from "../types";

export type JobRepositoryExecutorProvider = () => DrizzleExecutor;

const DEFAULT_INSERT_CHUNK_SIZE = 500;
const ACTIVE_JOB_STATUSES = ["pending", "in_progress"] as const;

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

export function createJobRepository(
	getExecutor: JobRepositoryExecutorProvider,
	options: { insertChunkSize?: number } = {},
): JobRepositoryPort {
	const insertChunkSize = options.insertChunkSize ?? DEFAULT_INSERT_CHUNK_SIZE;

	return {
		async create(job: NewJobRecord): Promise<JobRecord> {
			const [created] = await getExecutor()
				.insert(jobs)
				.values(toInsertValue(job))
				.returning();
			return mapToJobRecord(created);
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
			if (!hasMediaIdPayload(job.payload)) {
				return await this.create(job);
			}
			const mediaId = job.payload.mediaId;

			const activeRows = await getExecutor()
				.select()
				.from(jobs)
				.where(
					and(
						eq(jobs.type, job.type),
						or(
							eq(jobs.status, ACTIVE_JOB_STATUSES[0]),
							eq(jobs.status, ACTIVE_JOB_STATUSES[1]),
						),
					),
				);
			const existing = activeRows.find(
				(row) =>
					hasMediaIdPayload(row.payload) && row.payload.mediaId === mediaId,
			);
			if (existing) {
				return null;
			}

			return await this.create(job);
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
