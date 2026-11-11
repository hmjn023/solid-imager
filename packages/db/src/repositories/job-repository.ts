import {
	batchParentJobTypes,
	type BatchProgress,
	type IJobRepository,
	type Job,
	type NewJob,
	jobTerminalStatusSchema,
	isBatchParentJobType,
} from "@solid-imager/core/jobs";
import { batchParentPayloadSchema } from "@solid-imager/core/tagging";
import { generateThumbnailJobPayloadSchema } from "@solid-imager/core/thumbnails";
import { isJobStatus } from "@solid-imager/core/utils";
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

/** Creates the database repository that claims jobs and persists their execution state and batch progress. */
export function createJobRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): IJobRepository {
	const db = () => getExecutor();

	return {
		async create(job: NewJob): Promise<Job> {
			const [created] = await db().insert(jobs).values(job).returning();
			return mapJob(created);
		},

		async createBatch(parent, dispatch) {
			if (
				!isBatchParentJobType(parent.type) ||
				parent.status !== "in_progress"
			) {
				throw new Error(
					"Batch parents must be non-executable progress records",
				);
			}
			return db().transaction(async (tx) => {
				const [created] = await tx.insert(jobs).values(parent).returning();
				await tx.insert(jobs).values({ ...dispatch, parentId: created.id });
				return mapJob(created);
			});
		},

		async finishAttempt(id, attemptCount, outcome) {
			// The row lock taken by this UPDATE orders a concurrent cancellation
			// against completion. A cancelled current attempt always becomes terminal.
			return db().transaction(async (tx) => {
				const cancel = sql`${jobs.cancelRequestedAt} IS NOT NULL OR ${outcome.status === "cancelled"}`;
				const [finished] = await tx
					.update(jobs)
					.set({
						status: sql`(CASE WHEN ${cancel} THEN 'cancelled' ELSE ${outcome.status} END)::job_status`,
						result:
							outcome.status === "completed"
								? sql`CASE WHEN ${cancel} THEN NULL ELSE ${JSON.stringify(outcome.result ?? null)}::jsonb END`
								: null,
						error:
							outcome.status === "failed"
								? sql`CASE WHEN ${cancel} THEN NULL ELSE ${outcome.error} END`
								: null,
						cancelledAt: sql`CASE WHEN ${cancel} THEN NOW() ELSE NULL END`,
						cancelRequestedAt: sql`CASE WHEN ${cancel} THEN COALESCE(${jobs.cancelRequestedAt}, NOW()) ELSE NULL END`,
						finishedAt: sql`NOW()`,
						updatedAt: sql`NOW()`,
						artifactPath: sql`CASE WHEN ${cancel} THEN NULL ELSE ${jobs.artifactPath} END`,
						artifactFileName: sql`CASE WHEN ${cancel} THEN NULL ELSE ${jobs.artifactFileName} END`,
						artifactContentType: sql`CASE WHEN ${cancel} THEN NULL ELSE ${jobs.artifactContentType} END`,
						artifactSize: sql`CASE WHEN ${cancel} THEN NULL ELSE ${jobs.artifactSize} END`,
						artifactExpiresAt: sql`CASE WHEN ${cancel} THEN NULL ELSE ${jobs.artifactExpiresAt} END`,
					})
					.where(
						and(
							eq(jobs.id, id),
							eq(jobs.status, "in_progress"),
							eq(jobs.attemptCount, attemptCount),
						),
					)
					.returning();
				if (!finished) return null;
				if (finished.parentId) {
					// Serialize sibling terminal commits before taking a fresh snapshot of
					// all children. Otherwise concurrent last children can each see the
					// other's uncommitted in-progress row and both skip parent closure.
					await tx
						.select({ id: jobs.id })
						.from(jobs)
						.where(eq(jobs.id, finished.parentId))
						.for("update");
				}
				if (finished.parentId && finished.status !== "completed") {
					// Malformed payloads and failed dispatches can fail before a handler
					// records item progress. They must not strand an open aggregate.
					await tx
						.update(jobs)
						.set({
							status: "failed",
							error: "A batch job failed or was cancelled",
							finishedAt: sql`NOW()`,
							updatedAt: sql`NOW()`,
						})
						.where(
							and(
								eq(jobs.id, finished.parentId),
								eq(jobs.status, "in_progress"),
								inArray(jobs.type, [...batchParentJobTypes]),
							),
						);
				} else if (finished.parentId) {
					await finishBatchWith(tx, finished.parentId);
				}
				return jobTerminalStatusSchema.parse(finished.status);
			});
		},

		async finishBatch(id) {
			return finishBatchWith(db(), id);
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
				notInArray(jobs.type, [...batchParentJobTypes]),
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
			await db().transaction(async (tx) => {
				const [cancelled] = await tx
					.update(jobs)
					.set({
						status: sql`(CASE WHEN ${jobs.status} = 'pending' THEN 'cancelled' ELSE 'in_progress' END)::job_status`,
						cancelRequestedAt: sql`COALESCE(${jobs.cancelRequestedAt}, NOW())`,
						cancelledAt: sql`CASE WHEN ${jobs.status} = 'pending' THEN NOW() ELSE NULL END`,
						finishedAt: sql`CASE WHEN ${jobs.status} = 'pending' THEN NOW() ELSE NULL END`,
						artifactPath: sql`CASE WHEN ${jobs.status} = 'pending' THEN NULL ELSE ${jobs.artifactPath} END`,
						artifactFileName: sql`CASE WHEN ${jobs.status} = 'pending' THEN NULL ELSE ${jobs.artifactFileName} END`,
						artifactContentType: sql`CASE WHEN ${jobs.status} = 'pending' THEN NULL ELSE ${jobs.artifactContentType} END`,
						artifactSize: sql`CASE WHEN ${jobs.status} = 'pending' THEN NULL ELSE ${jobs.artifactSize} END`,
						artifactExpiresAt: sql`CASE WHEN ${jobs.status} = 'pending' THEN NULL ELSE ${jobs.artifactExpiresAt} END`,
						updatedAt: sql`NOW()`,
					})
					.where(
						and(
							eq(jobs.id, id),
							inArray(jobs.status, ["pending", "in_progress"]),
						),
					)
					.returning();
				if (cancelled?.status === "cancelled" && cancelled.parentId) {
					await tx
						.update(jobs)
						.set({
							status: "failed",
							error: "A batch job was cancelled",
							finishedAt: sql`NOW()`,
							updatedAt: sql`NOW()`,
						})
						.where(
							and(
								eq(jobs.id, cancelled.parentId),
								eq(jobs.status, "in_progress"),
								inArray(jobs.type, [...batchParentJobTypes]),
							),
						);
				}
			});
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

		/** Sets the dispatched item count while preserving progress recorded concurrently by children. */
		async setBatchTotal(parentId, total) {
			const [parent] = await db()
				.update(jobs)
				.set({
					payload: sql`jsonb_set(${normalizedPayloadExpression()}, '{total}', to_jsonb(${total}::int))`,
					updatedAt: new Date(),
				})
				.where(eq(jobs.id, parentId))
				.returning();
			return batchParentPayloadSchema.parse(parent?.payload);
		},

		/** Applies the difference from the child’s last recorded outcome to its open parent. Returns null for stale attempts or closed batches. */
		async recordBatchChildOutcome(
			parentId,
			childId,
			attempt,
			processed,
			failed,
		) {
			// Keep the child's last contribution in its payload across retry/stale recovery.
			// Applying both deltas in one update also accounts for mixed-result chunks.
			const payload = normalizedPayloadExpression();
			const result = await db().execute(sql`
				WITH previous AS (
					SELECT id, ${payload} AS data, COALESCE(result, '{}'::jsonb) AS legacy_result FROM ${jobs}
					WHERE id = ${childId} AND parent_id = ${parentId}
					  AND attempt_count = ${attempt} AND status = 'in_progress'
					FOR UPDATE
				), ambiguous_legacy AS (
					UPDATE ${jobs} parent SET status = 'failed', error = 'Legacy chunk progress requires a new batch', finished_at = NOW(), updated_at = NOW()
					FROM previous WHERE parent.id = ${parentId} AND parent.status = 'in_progress'
					AND previous.data->'batchOutcome' IS NULL
					AND (previous.legacy_result ? 'parentProcessed' OR previous.legacy_result ? 'parentFailed')
					AND jsonb_typeof(previous.data->'mediaIds') = 'array'
					AND CASE WHEN jsonb_typeof(previous.data->'mediaIds') = 'array' THEN jsonb_array_length(previous.data->'mediaIds') ELSE 0 END > 1
					RETURNING parent.id
				), recorded AS (
					UPDATE ${jobs} AS child SET payload = previous.data ||
						jsonb_build_object('batchOutcome', jsonb_build_object(
							'processed', ${processed}::int, 'failed', ${failed}::int))
					FROM previous WHERE child.id = previous.id AND NOT EXISTS (SELECT 1 FROM ambiguous_legacy)
					RETURNING COALESCE((previous.data#>>'{batchOutcome,processed}')::int, CASE WHEN previous.legacy_result ? 'parentProcessed' THEN 1 ELSE 0 END) AS old_processed,
						COALESCE((previous.data#>>'{batchOutcome,failed}')::int, CASE WHEN previous.legacy_result ? 'parentFailed' THEN 1 ELSE 0 END) AS old_failed
				)
				UPDATE ${jobs} SET payload = ${payload} || jsonb_build_object(
					'processed', COALESCE((${payload}->>'processed')::int,0) + ${processed} - recorded.old_processed,
					'failed', COALESCE((${payload}->>'failed')::int,0) + ${failed} - recorded.old_failed
				), updated_at = NOW()
				FROM recorded WHERE id = ${parentId} AND status = 'in_progress'
				RETURNING payload
			`);
			const [row] = extractRows(result);
			if (!row || typeof row !== "object" || !("payload" in row)) return null;
			return batchParentPayloadSchema.parse(
				parseJsonColumn(row.payload, "payload"),
			);
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
				sql`type NOT IN ${sqlTuple([...batchParentJobTypes])}`,
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
			return db().transaction(async (tx) => {
				const staleBaseCondition = and(
					eq(jobs.status, "in_progress"),
					lt(jobs.updatedAt, olderThan),
					notInArray(jobs.type, [...batchParentJobTypes]),
				);
				const cancelledRows = await tx
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
				// A crashed worker will never call finishAttempt. Recovery owns both
				// this terminal cancellation and the aggregate's early-failure policy.
				const parentIds = new Set(
					cancelledRows.flatMap((child) =>
						child.parentId ? [child.parentId] : [],
					),
				);
				for (const parentId of [...parentIds].sort()) {
					await tx
						.update(jobs)
						.set({
							status: "failed",
							error: "A batch job was cancelled",
							finishedAt: sql`NOW()`,
							updatedAt: sql`NOW()`,
						})
						.where(
							and(
								eq(jobs.id, parentId),
								eq(jobs.status, "in_progress"),
								inArray(jobs.type, [...batchParentJobTypes]),
							),
						);
				}

				const rows = await tx
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
			});
		},
	};
}

/** Uses the caller's transaction so the final child and its aggregate commit together. */
async function finishBatchWith(
	executor: Pick<DrizzleExecutor, "update">,
	id: string,
) {
	const payload = normalizedPayloadExpression();
	const [finished] = await executor
		.update(jobs)
		.set({
			status: sql`(CASE WHEN COALESCE((${payload}->>'failed')::int,0) > 0 THEN 'failed' ELSE 'completed' END)::job_status`,
			finishedAt: sql`NOW()`,
			updatedAt: sql`NOW()`,
		})
		.where(
			and(
				eq(jobs.id, id),
				eq(jobs.status, "in_progress"),
				inArray(jobs.type, [...batchParentJobTypes]),
				sql`COALESCE((${payload}->>'processed')::int,0) + COALESCE((${payload}->>'failed')::int,0) >= COALESCE((${payload}->>'total')::int,0)`,
				sql`NOT EXISTS (SELECT 1 FROM jobs child WHERE child.parent_id = ${jobs.id} AND child.status IN ('pending', 'in_progress'))`,
			),
		)
		.returning();
	return finished ? jobTerminalStatusSchema.parse(finished.status) : null;
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
