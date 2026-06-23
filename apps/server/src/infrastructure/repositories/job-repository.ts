import { and, asc, eq, inArray, lt, ne, notInArray, sql } from "drizzle-orm";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import { db } from "~/infrastructure/db";
import { type Job, jobs, type NewJob } from "~/infrastructure/db/schema";

type FindPendingOptions = { excludeTypes?: string[]; includeTypes?: string[] };

type RawClaimedJob = {
	id: unknown;
	type: unknown;
	mediaSourceId: unknown;
	status: unknown;
	payload: unknown;
	result: unknown;
	error: unknown;
	createdAt: unknown;
	updatedAt: unknown;
	parentId: unknown;
};

export class JobRepository implements IJobRepository {
	async create(job: NewJob): Promise<Job> {
		const [created] = await db.insert(jobs).values(job).returning();
		return created;
	}

	async createIfUnique(job: NewJob): Promise<Job | null> {
		const payload = job.payload;
		let mediaId: string | undefined;

		if (
			payload &&
			typeof payload === "object" &&
			"mediaId" in payload &&
			typeof (payload as { mediaId: unknown }).mediaId === "string"
		) {
			mediaId = (payload as { mediaId: string }).mediaId;
		}

		// Check duplication only if mediaId is present
		if (mediaId) {
			// Attempt atomic insert using onConflictDoNothing.
			// The unique index "jobs_type_media_id_pending_unique_idx" handles the constraint.
			const [created] = await db
				.insert(jobs)
				.values(job)
				.onConflictDoNothing()
				.returning();

			return created ?? null;
		}

		return this.create(job);
	}

	async findById(id: string): Promise<Job | null> {
		const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
		return job || null;
	}

	findPending(limit: number, options?: FindPendingOptions): Promise<Job[]> {
		const conditions = this.buildPendingConditions(options);
		return db
			.select()
			.from(jobs)
			.where(and(...conditions))
			.orderBy(asc(jobs.createdAt))
			.limit(limit);
	}

	async claimPending(
		limit: number,
		options?: FindPendingOptions,
	): Promise<Job[]> {
		if (limit <= 0) {
			return [];
		}

		this.validatePendingOptions(options);

		const conditions = [sql`status = 'pending'`, sql`type <> 'import_request'`];

		if (options?.excludeTypes?.length) {
			conditions.push(sql`type NOT IN ${sqlTuple(options.excludeTypes)}`);
		}

		if (options?.includeTypes?.length) {
			conditions.push(sql`type IN ${sqlTuple(options.includeTypes)}`);
		}

		const now = new Date();
		const result: unknown = await db.execute(sql`
			WITH next_jobs AS (
				SELECT id
				FROM jobs
				WHERE ${sql.join(conditions, sql` AND `)}
				ORDER BY created_at ASC
				LIMIT ${limit}
				FOR UPDATE SKIP LOCKED
			)
			UPDATE jobs
			SET status = 'in_progress', updated_at = ${now}
			WHERE id IN (SELECT id FROM next_jobs)
			RETURNING
				id,
				type,
				source_id AS "mediaSourceId",
				status,
				payload,
				result,
				error,
				created_at AS "createdAt",
				updated_at AS "updatedAt",
				parent_id AS "parentId"
		`);

		return extractRows(result).map(mapClaimedJob);
	}

	async markAsInProgress(id: string): Promise<void> {
		await db
			.update(jobs)
			.set({
				status: "in_progress",
				updatedAt: new Date(),
			})
			.where(eq(jobs.id, id));
	}

	async requeueStaleInProgress(olderThan: Date): Promise<number> {
		const rows = await db
			.update(jobs)
			.set({
				status: "pending",
				updatedAt: new Date(),
			})
			.where(and(eq(jobs.status, "in_progress"), lt(jobs.updatedAt, olderThan)))
			.returning({ id: jobs.id });

		return rows.length;
	}

	async markAsCompleted(id: string, result?: unknown): Promise<void> {
		await db
			.update(jobs)
			.set({
				status: "completed",
				result,
				updatedAt: new Date(),
			})
			.where(eq(jobs.id, id));
	}

	async markAsFailed(id: string, error: string): Promise<void> {
		await db
			.update(jobs)
			.set({
				status: "failed",
				error,
				updatedAt: new Date(),
			})
			.where(eq(jobs.id, id));
	}

	async update(id: string, data: Partial<Job>): Promise<void> {
		await db.update(jobs).set(data).where(eq(jobs.id, id));
	}

	async incrementProgress(id: string): Promise<void> {
		await db.execute(
			sql`UPDATE ${jobs} SET payload = jsonb_set(payload, '{processed}', (COALESCE(payload->>'processed', '0')::int + 1)::text::jsonb) WHERE id = ${id}`,
		);
	}

	private buildPendingConditions(options?: FindPendingOptions) {
		this.validatePendingOptions(options);
		const conditions = [
			eq(jobs.status, "pending"),
			ne(jobs.type, "import_request"),
		];

		if (options?.excludeTypes?.length) {
			conditions.push(notInArray(jobs.type, options.excludeTypes));
		}

		if (options?.includeTypes?.length) {
			conditions.push(inArray(jobs.type, options.includeTypes));
		}

		return conditions;
	}

	private validatePendingOptions(options?: FindPendingOptions) {
		if (options?.excludeTypes?.length && options?.includeTypes?.length) {
			throw new Error(
				"Cannot use excludeTypes and includeTypes simultaneously.",
			);
		}
	}
}

function sqlTuple(values: string[]) {
	return sql`(${sql.join(
		values.map((value) => sql`${value}`),
		sql`, `,
	)})`;
}

function extractRows(result: unknown): unknown[] {
	if (Array.isArray(result)) {
		return result;
	}

	if (result && typeof result === "object" && "rows" in result) {
		const rows = (result as { rows: unknown }).rows;
		return Array.isArray(rows) ? rows : [];
	}

	return [];
}

function mapClaimedJob(row: unknown): Job {
	if (!row || typeof row !== "object") {
		throw new Error("Invalid claimed job row");
	}

	const raw = row as RawClaimedJob;
	return {
		id: requireString(raw.id, "id"),
		type: requireString(raw.type, "type"),
		mediaSourceId: nullableString(raw.mediaSourceId, "mediaSourceId"),
		status: requireJobStatus(raw.status),
		payload: raw.payload,
		result: raw.result,
		error: nullableString(raw.error, "error"),
		createdAt: requireDate(raw.createdAt, "createdAt"),
		updatedAt: requireDate(raw.updatedAt, "updatedAt"),
		parentId: nullableString(raw.parentId, "parentId"),
	};
}

function requireString(value: unknown, fieldName: string): string {
	if (typeof value !== "string") {
		throw new Error(`Invalid claimed job row: ${fieldName}`);
	}
	return value;
}

function nullableString(value: unknown, fieldName: string): string | null {
	if (value === null) {
		return null;
	}
	if (typeof value !== "string") {
		throw new Error(`Invalid claimed job row: ${fieldName}`);
	}
	return value;
}

function requireJobStatus(value: unknown): Job["status"] {
	if (
		value === "pending" ||
		value === "in_progress" ||
		value === "completed" ||
		value === "failed"
	) {
		return value;
	}
	throw new Error("Invalid claimed job row: status");
}

function requireDate(value: unknown, fieldName: string): Date {
	if (value instanceof Date) {
		return value;
	}
	if (typeof value === "string") {
		const date = new Date(value);
		if (!Number.isNaN(date.getTime())) {
			return date;
		}
	}
	throw new Error(`Invalid claimed job row: ${fieldName}`);
}
