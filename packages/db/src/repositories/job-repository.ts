import type {
	BatchProgress,
	IJobRepository,
	Job,
	NewJob,
} from "@solid-imager/core/domain/repositories/job-repository";
import { batchParentPayloadSchema } from "@solid-imager/core/domain/tagging/schemas";
import { isJobStatus } from "@solid-imager/core/utils/type-guards";
import {
	and,
	asc,
	eq,
	inArray,
	isNotNull,
	lt,
	ne,
	not,
	notInArray,
	type SQL,
	sql,
} from "drizzle-orm";
import { jobs } from "../schema";
import type { DrizzleExecutor } from "../types";

const LanceDbJobTypes = [
	"sync_lancedb",
	"sync_lancedb_full",
	"sync_lancedb_delta",
] as const;

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
			if (job.type === "sync_lancedb_delta" && job.mediaSourceId) {
				const [pending] = await db()
					.select()
					.from(jobs)
					.where(
						and(
							eq(jobs.type, job.type),
							eq(jobs.mediaSourceId, job.mediaSourceId),
							eq(jobs.status, "pending"),
						),
					)
					.limit(1);

				if (pending) {
					await db()
						.update(jobs)
						.set({
							payload: mergeDeltaPayload(pending.payload, job.payload),
							updatedAt: new Date(),
						})
						.where(eq(jobs.id, pending.id));
					return null;
				}

				const [created] = await db().insert(jobs).values(job).returning();
				return mapJob(created);
			}

			if (
				["sync_lancedb", "sync_lancedb_full", "sync_lancedb_delta"].includes(
					job.type,
				) &&
				job.mediaSourceId
			) {
				const [existing] = await db()
					.select({ id: jobs.id })
					.from(jobs)
					.where(
						and(
							inArray(
								jobs.type,
								job.type === "sync_lancedb_delta"
									? ["sync_lancedb_delta"]
									: ["sync_lancedb", "sync_lancedb_full"],
							),
							eq(jobs.mediaSourceId, job.mediaSourceId),
							inArray(jobs.status, ["pending", "in_progress"]),
						),
					)
					.limit(1);

				if (existing) {
					return null;
				}

				const [created] = await db().insert(jobs).values(job).returning();
				return mapJob(created);
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
				excludeLanceDbSourceIds?: string[];
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

			if (
				options?.excludeLanceDbSourceIds &&
				options.excludeLanceDbSourceIds.length > 0
			) {
				const innerCond = and(
					inArray(jobs.type, [
						"sync_lancedb",
						"sync_lancedb_full",
						"sync_lancedb_delta",
					]),
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
				excludeLanceDbSourceIds?: string[];
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

			if (
				options?.excludeLanceDbSourceIds &&
				options.excludeLanceDbSourceIds.length > 0
			) {
				conditions.push(
					sql`NOT (type IN ('sync_lancedb', 'sync_lancedb_full', 'sync_lancedb_delta') AND source_id IS NOT NULL AND source_id IN ${sqlTuple(
						options.excludeLanceDbSourceIds,
					)})`,
				);
			}

			const now = new Date();
			const query = canIncludeLanceDbJobs(options)
				? buildSerializedClaimQuery(conditions, limit, now)
				: buildSimpleClaimQuery(conditions, limit, now);
			const result: unknown = await db().execute(query);

			return extractRows(result).map(mapClaimedJob);
		},

		async requeueStaleInProgress(olderThan: Date): Promise<number> {
			const rows = await db()
				.update(jobs)
				.set({
					status: "pending",
					result: null,
					error: null,
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

function canIncludeLanceDbJobs(options?: {
	excludeTypes?: string[];
	includeTypes?: string[];
}): boolean {
	if (options?.includeTypes?.length) {
		return options.includeTypes.some((type) =>
			LanceDbJobTypes.some((lanceDbType) => lanceDbType === type),
		);
	}

	if (options?.excludeTypes?.length) {
		return LanceDbJobTypes.some(
			(type) => !options.excludeTypes?.includes(type),
		);
	}

	return true;
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

function buildSerializedClaimQuery(
	conditions: SQL[],
	limit: number,
	now: Date,
) {
	return sql`
		WITH eligible_jobs AS (
			SELECT id, created_at
			FROM jobs candidate
			WHERE ${sql.join(conditions, sql` AND `)}
				AND (
					type NOT IN ('sync_lancedb', 'sync_lancedb_full', 'sync_lancedb_delta')
					OR source_id IS NULL
				)
			UNION ALL
			(
				SELECT DISTINCT ON (source_id) id, created_at
				FROM jobs candidate
				WHERE ${sql.join(conditions, sql` AND `)}
					AND type IN ('sync_lancedb', 'sync_lancedb_full', 'sync_lancedb_delta')
					AND source_id IS NOT NULL
					AND NOT EXISTS (
						SELECT 1
						FROM jobs active
						WHERE active.status = 'in_progress'
							AND active.type IN (
								'sync_lancedb',
								'sync_lancedb_full',
								'sync_lancedb_delta'
							)
							AND active.source_id = candidate.source_id
					)
				ORDER BY source_id, created_at ASC, id ASC
			)
		),
		next_jobs AS (
			SELECT jobs.id
			FROM jobs
			INNER JOIN eligible_jobs ON eligible_jobs.id = jobs.id
			ORDER BY eligible_jobs.created_at ASC, jobs.id ASC
			LIMIT ${limit}
			FOR UPDATE OF jobs SKIP LOCKED
		)
		${buildClaimUpdate(now)}
	`;
}

function buildClaimUpdate(now: Date) {
	return sql`
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

function mergeDeltaPayload(
	existing: unknown,
	next: unknown,
): Record<string, unknown> {
	const existingRecord = isRecord(existing) ? existing : {};
	const nextRecord = isRecord(next) ? next : {};
	const mediaIds = [
		...extractStringArrayOrSingle(existingRecord.mediaId),
		...extractStringArray(existingRecord.mediaIds),
		...extractStringArrayOrSingle(nextRecord.mediaId),
		...extractStringArray(nextRecord.mediaIds),
	];
	const merged: Record<string, unknown> = {
		...existingRecord,
		...nextRecord,
		mediaIds: [...new Set(mediaIds)],
	};
	delete merged.mediaId;
	return merged;
}

function extractStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function extractStringArrayOrSingle(value: unknown): string[] {
	return typeof value === "string" ? [value] : [];
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
