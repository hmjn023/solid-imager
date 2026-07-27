import type {
	BatchProgress,
	BatchReconciliation,
  ClaimFailureResult,
  ClaimFence,
  ClaimOptions,
  IJobRepository,
  Job,
  NewJob,
} from "@solid-imager/core/domain/repositories/job-repository";
import { prepareJob } from "@solid-imager/core/domain/jobs/registry";
import { jobStatusSchema } from "@solid-imager/core/domain/jobs/schemas";
import { batchParentPayloadSchema } from "@solid-imager/core/domain/tagging/schemas";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  lt,
  ne,
  not,
  notInArray,
  type SQL,
  sql,
} from "drizzle-orm";
import { jobs, lanceDbSyncDirty } from "../schema";
import type { DrizzleExecutor } from "../types";

function mapJob(row: typeof jobs.$inferSelect): Job {
  return {
    id: row.id,
    type: row.type,
    mediaSourceId: row.mediaSourceId,
    status: jobStatusSchema.parse(row.status),
    payload: row.payload,
    result: row.result,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    parentId: row.parentId,
    queueName: row.queueName === "default" || row.queueName === "ai" ? row.queueName : null,
    targetId: row.targetId,
    inputRevision: row.inputRevision,
    dedupeKey: row.dedupeKey,
    concurrencyKey: row.concurrencyKey,
    availableAt: row.availableAt,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    leaseDurationMs: row.leaseDurationMs,
    claimToken: row.claimToken,
    claimedBy: row.claimedBy,
    claimedAt: row.claimedAt,
    heartbeatAt: row.heartbeatAt,
    errorCode: row.errorCode,
  };
}

export function createJobRepository(
  getExecutor: (tx?: unknown) => DrizzleExecutor,
): IJobRepository {
  const db = () => getExecutor();

  return {
    async create(job: NewJob): Promise<Job> {
      const prepared = prepareJob(job);
      const [created] = await db().insert(jobs).values(prepared).onConflictDoNothing().returning();
      if (created) return mapJob(created);
      if (prepared.dedupeKey) {
        const [existing] = await db()
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.dedupeKey, prepared.dedupeKey),
              inArray(jobs.status, ["pending", "in_progress"]),
            ),
          )
          .limit(1);
        if (existing) return mapJob(existing);
      }
      throw new Error("Job creation conflicted without an active duplicate");
    },

		async createIfUnique(job: NewJob): Promise<Job | null> {
      const prepared = prepareJob(job);
      if (prepared.type === "sync_lancedb_delta" && prepared.mediaSourceId) {
				const mediaSourceId = prepared.mediaSourceId;
				return await db().transaction(async (transaction) => {
					const dedupeKey = prepared.dedupeKey;
					if (!dedupeKey) {
						throw new Error("sync_lancedb_delta requires a dedupe key");
					}
					const dirtyChanges = getDeltaDirtyChanges(prepared.payload);
					const dirtyUpdatedAt = new Date();
					for (const operation of ["upsert", "delete"] as const) {
						const mediaIds = dirtyChanges
							.filter((change) => change.operation === operation)
							.map((change) => change.mediaId);
						if (mediaIds.length === 0) continue;
						await transaction
							.insert(lanceDbSyncDirty)
							.values(
								mediaIds.map((mediaId) => ({
									mediaSourceId,
									mediaId,
									operation,
									updatedAt: dirtyUpdatedAt,
								})),
							)
							.onConflictDoUpdate({
								target: [
									lanceDbSyncDirty.mediaSourceId,
									lanceDbSyncDirty.mediaId,
								],
								set: {
									operation,
									generation: sql`${lanceDbSyncDirty.generation} + 1`,
									attempts: 0,
									lastError: null,
									updatedAt: dirtyUpdatedAt,
								},
							});
					}

					const wakeJob = {
						...prepared,
						payload: getDeltaWakePayload(prepared.payload),
					};
					const [created] = await transaction
						.insert(jobs)
						.values(wakeJob)
						.onConflictDoNothing()
						.returning();
					if (created) return mapJob(created);

					const pending = await transaction
						.update(jobs)
						.set({ updatedAt: dirtyUpdatedAt })
						.where(
							and(
								eq(jobs.dedupeKey, dedupeKey),
								eq(jobs.status, "pending"),
							),
						)
						.returning();
					if (pending.length > 0) return null;

					const followUpKey = `${dedupeKey}:followup`;
					const [createdFollowUp] = await transaction
						.insert(jobs)
						.values({ ...wakeJob, id: undefined, dedupeKey: followUpKey })
						.onConflictDoNothing()
						.returning();
					return createdFollowUp ? mapJob(createdFollowUp) : null;
				});
      }

      const [created] = await db().insert(jobs).values(prepared).onConflictDoNothing().returning();

			return created ? mapJob(created) : null;
		},

		async createParentWithDispatch(
			parent: NewJob,
			dispatch: NewJob,
		): Promise<Job> {
			return await db().transaction(async (transaction) => {
				const [createdParent] = await transaction
					.insert(jobs)
					.values(prepareJob(parent))
					.returning();
				await transaction.insert(jobs).values(
					prepareJob({
						...dispatch,
						parentId: createdParent.id,
					}),
				);
				return mapJob(createdParent);
			});
		},

    async findById(id: string): Promise<Job | null> {
      const [job] = await db().select().from(jobs).where(eq(jobs.id, id));
      return job ? mapJob(job) : null;
    },

    async findPending(limit: number, options?: ClaimOptions): Promise<Job[]> {
      if (options?.excludeTypes?.length && options?.includeTypes?.length) {
        throw new Error("Cannot use excludeTypes and includeTypes simultaneously.");
      }

      const conditions = [
        eq(jobs.status, "pending"),
        ne(jobs.type, "import_request"),
        lte(jobs.availableAt, options?.now ?? new Date()),
      ];

      if (options?.excludeTypes?.length) {
        conditions.push(notInArray(jobs.type, options.excludeTypes));
      }

      if (options?.includeTypes?.length) {
        conditions.push(inArray(jobs.type, options.includeTypes));
      }

      if (options?.queueNames?.length) {
        conditions.push(
          sql`(${jobs.queueName} IN ${sqlTuple(options.queueNames)} OR ${jobs.queueName} IS NULL)`,
        );
      }

      if (options?.excludeLanceDbSourceIds && options.excludeLanceDbSourceIds.length > 0) {
        const innerCond = and(
          inArray(jobs.type, ["sync_lancedb", "sync_lancedb_full", "sync_lancedb_delta"]),
          isNotNull(jobs.mediaSourceId),
          inArray(jobs.mediaSourceId, options.excludeLanceDbSourceIds),
        );
        if (innerCond) {
          const excludeCond = not(innerCond);
          if (excludeCond) {
            conditions.push(excludeCond);
          }
        }
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
      await db()
        .update(jobs)
        .set({
          status: "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
    },

    async markAsCompleted(id: string, result?: unknown): Promise<void> {
      await db()
        .update(jobs)
        .set({
          status: "completed",
          result: result ?? null,
          error: null,
          errorCode: null,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
    },

    async markAsFailed(id: string, error: string): Promise<void> {
      await db()
        .update(jobs)
        .set({
          status: "failed",
          error,
          result: null,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
    },

    async update(id: string, data: Partial<Job>): Promise<void> {
      const updates: Partial<typeof jobs.$inferInsert> = {};
      if (data.type !== undefined) updates.type = data.type;
      if (data.mediaSourceId !== undefined) updates.mediaSourceId = data.mediaSourceId;
      if (data.status !== undefined) updates.status = data.status;
      if (data.payload !== undefined) updates.payload = data.payload;
      if (data.result !== undefined) updates.result = data.result;
      if (data.error !== undefined) updates.error = data.error;
      if (data.parentId !== undefined) updates.parentId = data.parentId;
      if (data.queueName !== undefined) updates.queueName = data.queueName;
      if (data.targetId !== undefined) updates.targetId = data.targetId;
      if (data.inputRevision !== undefined) updates.inputRevision = data.inputRevision;
      if (data.dedupeKey !== undefined) updates.dedupeKey = data.dedupeKey;
      if (data.concurrencyKey !== undefined) updates.concurrencyKey = data.concurrencyKey;
      if (data.availableAt !== undefined) updates.availableAt = data.availableAt;
      if (data.attemptCount !== undefined) updates.attemptCount = data.attemptCount;
      if (data.maxAttempts !== undefined) updates.maxAttempts = data.maxAttempts;
      if (data.leaseDurationMs !== undefined) updates.leaseDurationMs = data.leaseDurationMs;
      if (data.claimToken !== undefined) updates.claimToken = data.claimToken;
      if (data.claimedBy !== undefined) updates.claimedBy = data.claimedBy;
      if (data.claimedAt !== undefined) updates.claimedAt = data.claimedAt;
      if (data.heartbeatAt !== undefined) updates.heartbeatAt = data.heartbeatAt;
      if (data.errorCode !== undefined) updates.errorCode = data.errorCode;
      updates.updatedAt = new Date();

      await db().update(jobs).set(updates).where(eq(jobs.id, id));
    },

		async heartbeatClaim(id: string, fence: ClaimFence, at?: Date): Promise<boolean> {
			const heartbeatAt = at ?? sql`NOW()`;
      const rows = await db()
        .update(jobs)
				.set({ heartbeatAt, updatedAt: heartbeatAt })
        .where(claimFenceCondition(id, fence))
				.returning();
      return rows.length === 1;
    },

    async completeClaim(id: string, fence: ClaimFence, result?: unknown): Promise<boolean> {
      const rows = await db()
        .update(jobs)
        .set({
          status: "completed",
          result: result ?? null,
          error: null,
          errorCode: null,
          claimToken: null,
          claimedBy: null,
          claimedAt: null,
          heartbeatAt: null,
          updatedAt: new Date(),
        })
        .where(claimFenceCondition(id, fence))
				.returning();
      return rows.length === 1;
    },

    async failClaim(id, fence, failure): Promise<ClaimFailureResult | null> {
      const retryAt = failure.retryAt ?? new Date();
      const result = await db().execute(sql`
				UPDATE ${jobs}
				SET
					status = CASE
						WHEN ${failure.retryable} AND ${jobs.attemptCount} < ${jobs.maxAttempts}
							THEN 'pending'::job_status
						ELSE 'failed'::job_status
					END,
					available_at = CASE
						WHEN ${failure.retryable} AND ${jobs.attemptCount} < ${jobs.maxAttempts}
							THEN ${retryAt}
						ELSE ${jobs.availableAt}
					END,
					error = ${failure.error},
					error_code = ${failure.errorCode},
					result = NULL,
					claim_token = NULL,
					claimed_by = NULL,
					claimed_at = NULL,
					heartbeat_at = NULL,
					updated_at = NOW()
				WHERE ${claimFenceSql(id, fence)}
				RETURNING status, attempt_count AS "attemptCount"
			`);
      const row = extractRows(result)[0];
      if (!isRecord(row)) return null;
      const status = row.status;
      if (status !== "pending" && status !== "failed") {
        throw new Error("Invalid failClaim result");
      }
      const attemptCount = requireInteger(row.attemptCount, "attemptCount");
      return { status, attemptCount };
    },

    async releaseClaim(id, fence, availableAt = new Date()): Promise<boolean> {
      const rows = await db()
        .update(jobs)
        .set({
          status: "pending",
          availableAt,
          claimToken: null,
          claimedBy: null,
          claimedAt: null,
          heartbeatAt: null,
          updatedAt: new Date(),
        })
        .where(claimFenceCondition(id, fence))
				.returning();
      return rows.length === 1;
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

		async recomputeBatchProgress(
			id: string,
		): Promise<BatchReconciliation | null> {
			const result = await db().execute(sql`
				WITH parent_before AS MATERIALIZED (
					SELECT status
					FROM ${jobs}
					WHERE id = ${id}
						AND type IN ('bulk_tagging_parent', 'batch_ccip_parent')
					FOR UPDATE
				), child_counts AS (
					SELECT
						COALESCE(SUM(weight), 0)::int AS total,
						COALESCE(SUM(weight) FILTER (WHERE status = 'completed'), 0)::int AS processed,
						COALESCE(SUM(weight) FILTER (WHERE status IN ('failed', 'cancelled')), 0)::int AS failed
					FROM (
						SELECT
							status,
							CASE
								WHEN type = 'extract_ccip_vector'
									AND jsonb_typeof(payload->'mediaIds') = 'array'
									THEN jsonb_array_length(payload->'mediaIds')
								ELSE 1
							END AS weight
						FROM ${jobs}
						WHERE parent_id = ${id}
							AND type IN ('auto_tagging', 'extract_ccip_vector')
					) children
				), updated_parent AS (
					UPDATE ${jobs}
					SET status = CASE
						WHEN ${jobs.status} = 'in_progress'
							AND child_counts.total > 0
							AND child_counts.processed + child_counts.failed >= child_counts.total
							THEN CASE
								WHEN child_counts.failed > 0 THEN 'failed'::job_status
								ELSE 'completed'::job_status
							END
						ELSE ${jobs.status}
					END,
					payload = jsonb_set(
						jsonb_set(
							jsonb_set(
								COALESCE(payload, '{}'::jsonb),
								'{total}', to_jsonb(child_counts.total)
							),
							'{processed}', to_jsonb(child_counts.processed)
						),
						'{failed}', to_jsonb(child_counts.failed)
					),
					updated_at = NOW()
					FROM child_counts, parent_before
					WHERE ${jobs.id} = ${id}
						AND ${jobs.type} IN ('bulk_tagging_parent', 'batch_ccip_parent')
					RETURNING
						${jobs.payload},
						${jobs.status},
						parent_before.status AS "previousStatus"
				)
				SELECT payload, status, "previousStatus" FROM updated_parent
			`);
      const row = extractRows(result)[0];
      if (!isRecord(row)) return null;
      const parsed = batchParentPayloadSchema.safeParse(parseJsonColumn(row.payload, "payload"));
			const status = jobStatusSchema.safeParse(row.status);
			const previousStatus = jobStatusSchema.safeParse(row.previousStatus);
			return parsed.success && status.success && previousStatus.success
				? {
            processed: parsed.data.processed,
            failed: parsed.data.failed,
						total: parsed.data.total,
						status: status.data,
						transitioned:
							previousStatus.data === "in_progress" &&
							(status.data === "completed" || status.data === "failed"),
          }
        : null;
    },

    async claimPending(limit: number, options?: ClaimOptions): Promise<Job[]> {
      if (limit <= 0) {
        return [];
      }

      if (options?.excludeTypes?.length && options?.includeTypes?.length) {
        throw new Error("Cannot use excludeTypes and includeTypes simultaneously.");
      }

			const claimNow = options?.now ? sql`${options.now}` : sql`NOW()`;
      const conditions = [
        sql`candidate.status = 'pending'`,
        sql`candidate.type <> 'import_request'`,
        sql`candidate.type NOT IN ('batch_ccip_parent', 'bulk_tagging_parent')`,
				sql`candidate.available_at <= ${claimNow}`,
        sql`candidate.attempt_count < candidate.max_attempts`,
      ];

      if (options?.excludeTypes?.length) {
        conditions.push(sql`candidate.type NOT IN ${sqlTuple(options.excludeTypes)}`);
      }

      if (options?.includeTypes?.length) {
        conditions.push(sql`candidate.type IN ${sqlTuple(options.includeTypes)}`);
      }

      if (options?.queueNames?.length) {
        conditions.push(
          sql`(candidate.queue_name IN ${sqlTuple(options.queueNames)} OR candidate.queue_name IS NULL)`,
        );
      }

      if (options?.excludeLanceDbSourceIds && options.excludeLanceDbSourceIds.length > 0) {
        conditions.push(
          sql`NOT (candidate.type IN ('sync_lancedb', 'sync_lancedb_full', 'sync_lancedb_delta') AND candidate.source_id IS NOT NULL AND candidate.source_id IN ${sqlTuple(
            options.excludeLanceDbSourceIds,
          )})`,
        );
      }

			const query = buildClaimQuery(
				conditions,
				limit,
				claimNow,
				options?.workerId ?? "job-worker",
			);
      const result: unknown = await db().execute(query);

      return extractRows(result).map(mapClaimedJob);
    },

		async requeueExpiredLeases(now?: Date): Promise<number> {
			const recoveryNow = now ? sql`${now}` : sql`NOW()`;
      const result = await db().execute(sql`
				UPDATE ${jobs}
				SET
					status = CASE
						WHEN ${jobs.attemptCount} < ${jobs.maxAttempts}
							THEN 'pending'::job_status
						ELSE 'failed'::job_status
					END,
					available_at = ${recoveryNow},
					error = 'Job lease expired',
					error_code = 'LEASE_EXPIRED',
					claim_token = NULL,
					claimed_by = NULL,
					claimed_at = NULL,
					heartbeat_at = NULL,
					updated_at = ${recoveryNow}
				WHERE ${jobs.status} = 'in_progress'
					AND ${jobs.type} NOT IN ('batch_ccip_parent', 'bulk_tagging_parent')
					AND COALESCE(${jobs.heartbeatAt}, ${jobs.claimedAt}, ${jobs.updatedAt})
						+ (${jobs.leaseDurationMs} * INTERVAL '1 millisecond') <= ${recoveryNow}
				RETURNING ${jobs.id}, ${jobs.parentId} AS "parentId"
			`);
			const recoveredRows = extractRows(result);
			const parentIds = new Set<string>();
			for (const row of recoveredRows) {
				if (!isRecord(row)) continue;
				if (typeof row.parentId === "string") parentIds.add(row.parentId);
			}
			for (const parentId of parentIds) {
				await this.recomputeBatchProgress(parentId);
			}
			return recoveredRows.length;
    },

    async requeueStaleInProgress(olderThan: Date): Promise<number> {
      const rows = await db()
        .update(jobs)
        .set({
          status: "pending",
          claimToken: null,
          claimedBy: null,
          claimedAt: null,
          heartbeatAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobs.status, "in_progress"),
            lt(jobs.updatedAt, olderThan),
            notInArray(jobs.type, ["batch_ccip_parent", "bulk_tagging_parent"]),
          ),
        )
        .returning();

      return rows.length;
    },
  };
}

function buildClaimQuery(conditions: SQL[], limit: number, now: SQL, workerId: string) {
  return sql`
		WITH ranked_jobs AS MATERIALIZED (
			SELECT
				candidate.id,
				candidate.created_at,
				ROW_NUMBER() OVER (
					PARTITION BY COALESCE(candidate.concurrency_key, candidate.id::text)
					ORDER BY candidate.created_at ASC, candidate.id ASC
				) AS concurrency_rank
			FROM jobs candidate
			WHERE ${sql.join(conditions, sql` AND `)}
				AND (
					candidate.concurrency_key IS NULL
					OR NOT EXISTS (
						SELECT 1
						FROM jobs active
						WHERE active.status = 'in_progress'
							AND active.concurrency_key = candidate.concurrency_key
					)
			)
		),
		next_jobs AS (
			SELECT jobs.id
			FROM jobs
			INNER JOIN ranked_jobs ON ranked_jobs.id = jobs.id
			WHERE ranked_jobs.concurrency_rank = 1
			ORDER BY ranked_jobs.created_at ASC, jobs.id ASC
			LIMIT ${limit}
			FOR UPDATE OF jobs SKIP LOCKED
		)
		${buildClaimUpdate(now, workerId)}
	`;
}

function buildClaimUpdate(now: SQL, workerId: string) {
  return sql`
		UPDATE jobs
		SET
			status = 'in_progress',
			attempt_count = attempt_count + 1,
			claim_token = gen_random_uuid(),
			claimed_by = ${workerId},
			claimed_at = ${now},
			heartbeat_at = ${now},
			result = NULL,
			error = NULL,
			error_code = NULL,
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
			queue_name AS "queueName",
			target_id AS "targetId",
			input_revision AS "inputRevision",
			dedupe_key AS "dedupeKey",
			concurrency_key AS "concurrencyKey",
			available_at AS "availableAt",
			attempt_count AS "attemptCount",
			max_attempts AS "maxAttempts",
			lease_duration_ms AS "leaseDurationMs",
			claim_token AS "claimToken",
			claimed_by AS "claimedBy",
			claimed_at AS "claimedAt",
			heartbeat_at AS "heartbeatAt",
			error_code AS "errorCode"
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
  if (!isRecord(row)) {
    throw new Error("Invalid claimed job row");
  }

	const raw = row;
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
    queueName: nullableQueueName(raw.queueName),
    targetId: nullableString(raw.targetId, "targetId"),
    inputRevision: nullableString(raw.inputRevision, "inputRevision"),
    dedupeKey: nullableString(raw.dedupeKey, "dedupeKey"),
    concurrencyKey: nullableString(raw.concurrencyKey, "concurrencyKey"),
    availableAt: requireDate(raw.availableAt, "availableAt"),
    attemptCount: requireInteger(raw.attemptCount, "attemptCount"),
    maxAttempts: requireInteger(raw.maxAttempts, "maxAttempts"),
    leaseDurationMs: requireInteger(raw.leaseDurationMs, "leaseDurationMs"),
    claimToken: nullableString(raw.claimToken, "claimToken"),
    claimedBy: nullableString(raw.claimedBy, "claimedBy"),
    claimedAt: nullableDate(raw.claimedAt, "claimedAt"),
    heartbeatAt: nullableDate(raw.heartbeatAt, "heartbeatAt"),
    errorCode: nullableString(raw.errorCode, "errorCode"),
  };
}

function claimFenceCondition(id: string, fence: ClaimFence) {
  return and(
    eq(jobs.id, id),
    eq(jobs.status, "in_progress"),
    eq(jobs.claimToken, fence.claimToken),
    fence.inputRevision === null
      ? isNull(jobs.inputRevision)
      : eq(jobs.inputRevision, fence.inputRevision),
  );
}

function claimFenceSql(id: string, fence: ClaimFence) {
  return sql`${jobs.id} = ${id}
		AND ${jobs.status} = 'in_progress'
		AND ${jobs.claimToken} = ${fence.claimToken}
		AND ${jobs.inputRevision} IS NOT DISTINCT FROM ${fence.inputRevision}`;
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

function nullableQueueName(value: unknown): Job["queueName"] {
  if (value === null) return null;
  if (value === "default" || value === "ai") return value;
  throw new Error("Invalid claimed job row: queueName");
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

function requireInteger(value: unknown, fieldName: string): number {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid claimed job row: ${fieldName}`);
  }
  return parsed;
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
  return value === null ? null : requireDate(value, fieldName);
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

function getDeltaDirtyChanges(payload: unknown): Array<{
	mediaId: string;
	operation: "upsert" | "delete";
}> {
	if (!isRecord(payload)) return [];
	const operation = payload.operation === "delete" ? "delete" : "upsert";
	const mediaIds = Array.isArray(payload.mediaIds)
		? payload.mediaIds.filter(
				(value): value is string => typeof value === "string" && value.length > 0,
			)
		: typeof payload.mediaId === "string" && payload.mediaId.length > 0
			? [payload.mediaId]
			: [];
	return [...new Set(mediaIds)].map((mediaId) => ({ mediaId, operation }));
}

function getDeltaWakePayload(payload: unknown): Record<string, unknown> {
	if (!isRecord(payload)) return { reason: "dirty" };
	return {
		reason: typeof payload.reason === "string" ? payload.reason : "dirty",
		...(typeof payload.batchSize === "number"
			? { batchSize: payload.batchSize }
			: {}),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  const resultMarker = field === "processed" ? "parentProcessed" : "parentFailed";
  const otherResultMarker = field === "processed" ? "parentFailed" : "parentProcessed";

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
  const payload = parseJsonColumn((rows[0] as { payload?: unknown }).payload, "payload");
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
