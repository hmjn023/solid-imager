import { batchParentJobTypes } from "@solid-imager/core/domain/jobs/schemas";
import type {
	BatchProgress,
	IJobRepository,
	Job,
	NewJob,
} from "@solid-imager/core/domain/repositories/job-repository";
import { batchParentPayloadSchema } from "@solid-imager/core/domain/tagging/schemas";
import { generateThumbnailJobPayloadSchema } from "@solid-imager/core/domain/thumbnails/schemas";
import { isJobStatus } from "@solid-imager/core/utils/type-guards";
import {
	and,
	asc,
	eq,
	inArray,
	isNotNull,
	isNull,
	lt,
	ne,
	notInArray,
	type SQL,
	sql,
} from "drizzle-orm";
import { jobs } from "../schema";
import type { DrizzleExecutor } from "../types";

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
	cancelRequestedAt: unknown;
	cancelledAt: unknown;
	attemptCount: unknown;
	startedAt: unknown;
	finishedAt: unknown;
	artifactPath: unknown;
	artifactFileName: unknown;
	artifactContentType: unknown;
	artifactSize: unknown;
	artifactExpiresAt: unknown;
};

function mapJob(row: typeof jobs.$inferSelect): Job {
	return {
		id: row.id,
		type: row.type,
		mediaSourceId: row.mediaSourceId,
		status: isJobStatus(row.status) ? row.status : "pending",
		payload: row.payload,
		result: row.result,
		error: row.error,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		parentId: row.parentId,
		cancelRequestedAt: row.cancelRequestedAt,
		cancelledAt: row.cancelledAt,
		attemptCount: row.attemptCount,
		startedAt: row.startedAt,
		finishedAt: row.finishedAt,
		artifactPath: row.artifactPath,
		artifactFileName: row.artifactFileName,
		artifactContentType: row.artifactContentType,
		artifactSize: row.artifactSize,
		artifactExpiresAt: row.artifactExpiresAt,
	};
}

export function createJobRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): IJobRepository {
	const db = () => getExecutor();

	return {
		async create(job: NewJob): Promise<Job> {
			const [created] = await db().insert(jobs).values(job).returning();
			return mapJob(created);
		},

		async createIfUnique(job: NewJob): Promise<Job | null> {
			if (job.type === "generate_thumbnail" && job.mediaSourceId) {
				generateThumbnailJobPayloadSchema.parse(job.payload);
				const [created] = await db()
					.insert(jobs)
					.values(job)
					.onConflictDoNothing()
					.returning();
				return created ? mapJob(created) : null;
			}

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

			if (mediaId) {
				const [created] = await db()
					.insert(jobs)
					.values(job)
					.onConflictDoNothing()
					.returning();

				return created ? mapJob(created) : null;
			}

			return this.create(job);
		},

		async findById(id: string): Promise<Job | null> {
			const [job] = await db().select().from(jobs).where(eq(jobs.id, id));
			return job ? mapJob(job) : null;
		},

		async findPending(
			limit: number,
			options?: {
				excludeTypes?: string[];
				includeTypes?: string[];
			},
		): Promise<Job[]> {
			if (options?.excludeTypes?.length && options?.includeTypes?.length) {
				throw new Error(
					"Cannot use excludeTypes and includeTypes simultaneously.",
				);
			}

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

			const rows = await db()
				.select()
				.from(jobs)
				.where(and(...conditions))
				.orderBy(asc(jobs.createdAt))
				.limit(limit);
			return rows.map(mapJob);
		},

		async markAsInProgress(id: string): Promise<void> {
			const now = new Date();
			await db()
				.update(jobs)
				.set({
					status: "in_progress",
					attemptCount: sql`${jobs.attemptCount} + 1`,
					startedAt: now,
					finishedAt: null,
					cancelRequestedAt: null,
					cancelledAt: null,
					updatedAt: now,
				})
				.where(eq(jobs.id, id));
		},

		async markAsCompleted(
			id: string,
			result: unknown,
			attemptCount: number,
		): Promise<boolean> {
			const now = new Date();
			const rows = await db()
				.update(jobs)
				.set({
					status: "completed",
					result: result ?? null,
					finishedAt: now,
					updatedAt: now,
				})
				.where(
					and(
						eq(jobs.id, id),
						eq(jobs.status, "in_progress"),
						eq(jobs.attemptCount, attemptCount),
						isNull(jobs.cancelRequestedAt),
					),
				)
				.returning();
			return rows.length > 0;
		},

		async markAsFailed(
			id: string,
			error: string,
			attemptCount: number,
		): Promise<boolean> {
			const now = new Date();
			const rows = await db()
				.update(jobs)
				.set({
					status: "failed",
					error,
					finishedAt: now,
					updatedAt: now,
				})
				.where(
					and(
						eq(jobs.id, id),
						eq(jobs.status, "in_progress"),
						eq(jobs.attemptCount, attemptCount),
						isNull(jobs.cancelRequestedAt),
					),
				)
				.returning();
			return rows.length > 0;
		},

		async requestCancellation(id: string): Promise<void> {
			const now = new Date();
			const cancelledPending = await db()
				.update(jobs)
				.set({
					status: "cancelled",
					cancelRequestedAt: now,
					cancelledAt: now,
					finishedAt: now,
					artifactPath: null,
					artifactFileName: null,
					artifactContentType: null,
					artifactSize: null,
					artifactExpiresAt: null,
					updatedAt: now,
				})
				.where(and(eq(jobs.id, id), eq(jobs.status, "pending")))
				.returning();

			if (cancelledPending.length > 0) {
				return;
			}

			await db()
				.update(jobs)
				.set({
					cancelRequestedAt: now,
					updatedAt: now,
				})
				.where(
					and(
						eq(jobs.id, id),
						eq(jobs.status, "in_progress"),
						isNull(jobs.cancelRequestedAt),
					),
				);
		},

		async markAsCancelled(
			id: string,
			reason: string | undefined,
			attemptCount: number,
		): Promise<boolean> {
			const now = new Date();
			const updates: Partial<typeof jobs.$inferInsert> = {
				status: "cancelled",
				cancelRequestedAt: now,
				cancelledAt: now,
				finishedAt: now,
				updatedAt: now,
			};
			if (reason) {
				updates.error = reason;
			}
			updates.artifactPath = null;
			updates.artifactFileName = null;
			updates.artifactContentType = null;
			updates.artifactSize = null;
			updates.artifactExpiresAt = null;

			const rows = await db()
				.update(jobs)
				.set(updates)
				.where(
					and(
						eq(jobs.id, id),
						eq(jobs.status, "in_progress"),
						eq(jobs.attemptCount, attemptCount),
					),
				)
				.returning();
			return rows.length > 0;
		},

		async isCancellationRequested(id: string): Promise<boolean> {
			const [job] = await db()
				.select({
					status: jobs.status,
					cancelRequestedAt: jobs.cancelRequestedAt,
				})
				.from(jobs)
				.where(eq(jobs.id, id));
			return Boolean(
				job && (job.status === "cancelled" || job.cancelRequestedAt !== null),
			);
		},

		async setArtifact(id, artifact): Promise<void> {
			await db()
				.update(jobs)
				.set({
					artifactPath: artifact.path,
					artifactFileName: artifact.fileName,
					artifactContentType: artifact.contentType,
					artifactSize: artifact.size,
					artifactExpiresAt: artifact.expiresAt,
					updatedAt: new Date(),
				})
				.where(eq(jobs.id, id));
		},

		async update(id: string, data: Partial<Job>): Promise<void> {
			const updates: Partial<typeof jobs.$inferInsert> = {};
			if (data.type !== undefined) updates.type = data.type;
			if (data.mediaSourceId !== undefined)
				updates.mediaSourceId = data.mediaSourceId;
			if (data.status !== undefined) updates.status = data.status;
			if (data.payload !== undefined) updates.payload = data.payload;
			if (data.result !== undefined) updates.result = data.result;
			if (data.error !== undefined) updates.error = data.error;
			if (data.parentId !== undefined) updates.parentId = data.parentId;
			if (data.cancelRequestedAt !== undefined)
				updates.cancelRequestedAt = data.cancelRequestedAt;
			if (data.cancelledAt !== undefined)
				updates.cancelledAt = data.cancelledAt;
			if (data.attemptCount !== undefined)
				updates.attemptCount = data.attemptCount;
			if (data.startedAt !== undefined) updates.startedAt = data.startedAt;
			if (data.finishedAt !== undefined) updates.finishedAt = data.finishedAt;
			if (data.artifactPath !== undefined)
				updates.artifactPath = data.artifactPath;
			if (data.artifactFileName !== undefined)
				updates.artifactFileName = data.artifactFileName;
			if (data.artifactContentType !== undefined)
				updates.artifactContentType = data.artifactContentType;
			if (data.artifactSize !== undefined)
				updates.artifactSize = data.artifactSize;
			if (data.artifactExpiresAt !== undefined)
				updates.artifactExpiresAt = data.artifactExpiresAt;
			updates.updatedAt = new Date();

			await db().update(jobs).set(updates).where(eq(jobs.id, id));
		},

		async incrementProgress(
			id: string,
			progressKey?: string,
			amount = 1,
		): Promise<BatchProgress | null> {
			return incrementBatchCount(db, id, "processed", progressKey, amount);
		},

		async incrementFailedCount(
			id: string,
			progressKey?: string,
			amount = 1,
		): Promise<BatchProgress | null> {
			return incrementBatchCount(db, id, "failed", progressKey, amount);
		},

		async claimPending(
			limit: number,
			options?: {
				excludeTypes?: string[];
				includeTypes?: string[];
			},
		): Promise<Job[]> {
			if (limit <= 0) {
				return [];
			}

			if (options?.excludeTypes?.length && options?.includeTypes?.length) {
				throw new Error(
					"Cannot use excludeTypes and includeTypes simultaneously.",
				);
			}

			const conditions = [
				sql`status = 'pending'`,
				sql`type <> 'import_request'`,
			];

			if (options?.excludeTypes?.length) {
				conditions.push(sql`type NOT IN ${sqlTuple(options.excludeTypes)}`);
			}

			if (options?.includeTypes?.length) {
				conditions.push(sql`type IN ${sqlTuple(options.includeTypes)}`);
			}

			const now = new Date();
			const query = buildSimpleClaimQuery(conditions, limit, now);
			const result: unknown = await db().execute(query);

			return extractRows(result).map(mapClaimedJob);
		},

		async requeueStaleInProgress(olderThan: Date): Promise<number> {
			const staleBaseCondition = and(
				eq(jobs.status, "in_progress"),
				lt(jobs.updatedAt, olderThan),
				notInArray(jobs.type, [...batchParentJobTypes]),
			);
			const cancelledRows = await db()
				.update(jobs)
				.set({
					status: "cancelled",
					cancelledAt: new Date(),
					finishedAt: new Date(),
					artifactPath: null,
					artifactFileName: null,
					artifactContentType: null,
					artifactSize: null,
					artifactExpiresAt: null,
					updatedAt: new Date(),
				})
				.where(and(staleBaseCondition, isNotNull(jobs.cancelRequestedAt)))
				.returning();

			const rows = await db()
				.update(jobs)
				.set({
					status: "pending",
					result: null,
					error: null,
					startedAt: null,
					updatedAt: new Date(),
				})
				.where(and(staleBaseCondition, isNull(jobs.cancelRequestedAt)))
				.returning();

			return rows.length + cancelledRows.length;
		},
	};
}

/**
 * Allocates a UUIDv7 using the database function before a job row exists.
 * Import uploads need the job ID to determine the input file path first.
 */
export async function allocateJobId(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): Promise<string> {
	const rows = extractRows(
		await getExecutor().execute(sql`SELECT uuidv7()::text AS id`),
	);
	const row = rows[0];
	if (
		!row ||
		typeof row !== "object" ||
		!("id" in row) ||
		typeof row.id !== "string"
	) {
		throw new Error("Failed to allocate a job ID");
	}
	return row.id;
}

function buildSimpleClaimQuery(conditions: SQL[], limit: number, now: Date) {
	return sql`
		WITH next_jobs AS (
			SELECT id
			FROM jobs
			WHERE ${sql.join(conditions, sql` AND `)}
			ORDER BY created_at ASC, id ASC
			LIMIT ${limit}
			FOR UPDATE SKIP LOCKED
		)
		${buildClaimUpdate(now)}
	`;
}

function buildClaimUpdate(now: Date) {
	return sql`
		UPDATE jobs
		SET status = 'in_progress',
			attempt_count = attempt_count + 1,
			started_at = ${now},
			finished_at = NULL,
			cancel_requested_at = NULL,
			cancelled_at = NULL,
			updated_at = ${now}
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
					parent_id AS "parentId",
			cancel_requested_at AS "cancelRequestedAt",
			cancelled_at AS "cancelledAt",
			attempt_count AS "attemptCount",
			started_at AS "startedAt",
			finished_at AS "finishedAt",
			artifact_path AS "artifactPath",
			artifact_file_name AS "artifactFileName",
			artifact_content_type AS "artifactContentType",
			artifact_size AS "artifactSize",
			artifact_expires_at AS "artifactExpiresAt"
	`;
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
		payload: parseJsonColumn(raw.payload, "payload"),
		result: parseJsonColumn(raw.result, "result"),
		error: nullableString(raw.error, "error"),
		createdAt: requireDate(raw.createdAt, "createdAt"),
		updatedAt: requireDate(raw.updatedAt, "updatedAt"),
		parentId: nullableString(raw.parentId, "parentId"),
		cancelRequestedAt: nullableDate(raw.cancelRequestedAt, "cancelRequestedAt"),
		cancelledAt: nullableDate(raw.cancelledAt, "cancelledAt"),
		attemptCount: nullableNumber(raw.attemptCount, "attemptCount") ?? 0,
		startedAt: nullableDate(raw.startedAt, "startedAt"),
		finishedAt: nullableDate(raw.finishedAt, "finishedAt"),
		artifactPath: nullableString(raw.artifactPath, "artifactPath"),
		artifactFileName: nullableString(raw.artifactFileName, "artifactFileName"),
		artifactContentType: nullableString(
			raw.artifactContentType,
			"artifactContentType",
		),
		artifactSize: nullableNumber(raw.artifactSize, "artifactSize"),
		artifactExpiresAt: nullableDate(raw.artifactExpiresAt, "artifactExpiresAt"),
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
		value === "failed" ||
		value === "cancelled"
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

function nullableDate(value: unknown, fieldName: string): Date | null {
	if (value === null || value === undefined) {
		return null;
	}
	return requireDate(value, fieldName);
}

function requireNumber(value: unknown, fieldName: string): number {
	const numberValue =
		typeof value === "number"
			? value
			: typeof value === "string" && value.trim() !== ""
				? Number(value)
				: null;
	if (numberValue === null || !Number.isFinite(numberValue)) {
		throw new Error(`Invalid claimed job row: ${fieldName}`);
	}
	return numberValue;
}

function nullableNumber(value: unknown, fieldName: string): number | null {
	if (value === null || value === undefined) {
		return null;
	}
	return requireNumber(value, fieldName);
}

function parseJsonColumn(value: unknown, fieldName: string): unknown {
	if (typeof value !== "string") {
		return value;
	}
	try {
		return JSON.parse(value);
	} catch {
		throw new Error(`Invalid claimed job row: ${fieldName}`);
	}
}

function normalizedPayloadExpression() {
	return sql`COALESCE(
		CASE
			WHEN jsonb_typeof(payload) = 'string' THEN (payload#>>'{}')::jsonb
			ELSE payload
		END,
		'{}'::jsonb
	)`;
}

async function incrementBatchCount(
	getExecutor: () => DrizzleExecutor,
	id: string,
	field: "processed" | "failed",
	progressKey?: string,
	amount = 1,
): Promise<BatchProgress | null> {
	if (!Number.isInteger(amount) || amount < 1) {
		throw new Error("Batch progress amount must be a positive integer");
	}
	const normalizedPayload = normalizedPayloadExpression();
	const executor = getExecutor();
	const resultMarker =
		field === "processed" ? "parentProcessed" : "parentFailed";
	const otherResultMarker =
		field === "processed" ? "parentFailed" : "parentProcessed";

	let raw: unknown;

	if (progressKey) {
		raw = await executor.execute(sql`
			WITH updated_child AS (
				UPDATE ${jobs}
				SET result = COALESCE(result, '{}'::jsonb) || jsonb_build_object(${resultMarker}::text, true)
				WHERE id = ${progressKey}::uuid
					AND parent_id = ${id}
					AND NOT (COALESCE(result, '{}'::jsonb) ? ${resultMarker})
					AND NOT (COALESCE(result, '{}'::jsonb) ? ${otherResultMarker})
				RETURNING id
			)
			UPDATE ${jobs}
			SET payload = jsonb_set(
				${normalizedPayload},
				${`{${field}}`},
				(COALESCE((${normalizedPayload}->>${field}), '0')::int + ${amount})::text::jsonb
			),
			updated_at = NOW()
			WHERE id = ${id}
				AND EXISTS (SELECT 1 FROM updated_child)
			RETURNING payload
		`);
	} else {
		raw = await executor.execute(sql`
			UPDATE ${jobs}
			SET payload = jsonb_set(
				${normalizedPayload},
				${`{${field}}`},
				(COALESCE((${normalizedPayload}->>${field}), '0')::int + ${amount})::text::jsonb
			),
			updated_at = NOW()
			WHERE id = ${id}
			RETURNING payload
		`);
	}

	const rows = extractRows(raw);
	if (rows.length === 0) {
		return null;
	}
	const payload = parseJsonColumn(
		(rows[0] as { payload?: unknown }).payload,
		"payload",
	);
	const parsed = batchParentPayloadSchema.safeParse(payload);
	if (!parsed.success) {
		return null;
	}
	return {
		processed: parsed.data.processed,
		failed: parsed.data.failed,
		total: parsed.data.total,
	};
}
