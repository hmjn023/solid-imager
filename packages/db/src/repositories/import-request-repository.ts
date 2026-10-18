import { canonicalJsonHash } from "../utils/canonical-json";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { IImportRequestRepository } from "@solid-imager/core/domain/repositories/import-request-repository";
import { ResourceConflictError } from "@solid-imager/core/domain/errors";
import {
	importItemSchema,
	importRequestSchema,
	type ImportRequest,
	type ImportCutoverReport,
	type ImportRequestStatus,
} from "@solid-imager/core/domain/imports/schemas";
import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import {
	importRequestCutovers,
	importRequestLegacySnapshots,
	importRequests,
	jobs,
	downloadRuns,
} from "../schema";
import { createTransactionManager } from "../transaction-manager";
import type { DrizzleExecutor } from "../types";

const CONTROL_ID = "62100000-0000-4000-8000-000000000001";
const emptyReport = (): ImportCutoverReport => ({
	migrated: 0,
	blocked: 0,
	aliases: 0,
});
function map(row: typeof importRequests.$inferSelect): ImportRequest {
	return importRequestSchema.parse({
		id: row.id,
		item: row.item,
		requestKey: row.requestKey,
		status: row.status,
		canonicalId: row.canonicalId,
		blockedReason: row.blockedReason,
		targetSourceId: row.targetSourceId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		approvedAt: row.approvedAt,
		cancelledAt: row.cancelledAt,
	});
}
function key(item: DownloadItem) {
	return canonicalJsonHash(importItemSchema.parse(item));
}
function normalizeLegacy(payload: unknown): unknown {
	if (typeof payload !== "string") return payload;
	try {
		const decoded: unknown = JSON.parse(payload);
		return decoded;
	} catch {
		return payload;
	}
}

export function createImportRequestRepository(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
): IImportRequestRepository {
	const transactions = createTransactionManager(() => getExecutor());
	return {
		async ensureCutover() {
			const [state] = await getExecutor()
				.select()
				.from(importRequestCutovers)
				.where(eq(importRequestCutovers.id, CONTROL_ID));
			if (state?.authority === "dedicated") return emptyReport();
			return transactions.transaction(async (tx) => {
				const db = getExecutor(tx);
				const [control] = await db
					.select()
					.from(importRequestCutovers)
					.where(eq(importRequestCutovers.id, CONTROL_ID))
					.for("update");
				if (!control)
					throw new ResourceConflictError(
						"Import request migration has not been applied",
					);
				if (control.authority === "dedicated") return emptyReport();
				if (control.generation > 0)
					throw new ResourceConflictError(
						"Imports are rolled back; dedicated writes are disabled",
					);
				// Deploy only after old import writers/in-flight approval requests are stopped and drained.
				await db.execute(sql`LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE`);
				const report = emptyReport();
				let cursor: string | undefined;
				while (true) {
					const legacy = await db
						.select({
							id: jobs.id,
							payload: jobs.payload,
							status: jobs.status,
							mediaSourceId: jobs.mediaSourceId,
							createdAt: jobs.createdAt,
							updatedAt: jobs.updatedAt,
						})
						.from(jobs)
						.where(
							and(
								eq(jobs.type, "import_request"),
								cursor ? gt(jobs.id, cursor) : undefined,
							),
						)
						.orderBy(asc(jobs.id))
						.limit(250)
						.for("update");
					if (!legacy.length) break;
					for (const row of legacy) {
						const parsed = importItemSchema.safeParse(
							normalizeLegacy(row.payload),
						);
						const item = parsed.success ? parsed.data : null;
						let status: ImportRequestStatus =
							!item || row.status === "failed"
								? "blocked"
								: row.status === "completed"
									? "approved"
									: row.status === "cancelled"
										? "cancelled"
										: "pending";
						const [existingReservation] =
							item && status === "pending"
								? await db
										.select({ id: jobs.id })
										.from(jobs)
										.where(
											and(
												eq(jobs.type, "downloadImage"),
												sql`${jobs.createdAt} >= (SELECT original.created_at FROM jobs AS original WHERE original.id = ${row.id}::uuid)`,
												sql`${jobs.payload}->>'targetUrl' = ${item.targetUrl}`,
											),
										)
										.limit(1)
								: [];
						const [dedicatedReservation] =
							item && status === "pending"
								? await db
										.select({ id: downloadRuns.id })
										.from(downloadRuns)
										.where(
											and(
												sql`${downloadRuns.createdAt} >= (SELECT original.created_at FROM jobs AS original WHERE original.id = ${row.id}::uuid)`,
												sql`${downloadRuns.input}->>'targetUrl' = ${item.targetUrl}`,
											),
										)
										.limit(1)
								: [];
						// Old approval queued downloads before saving completion. Do not guess or replay an ambiguous reservation.
						if (existingReservation || dedicatedReservation) status = "blocked";
						const requestKey = item ? key(item) : `invalid:${row.id}`;
						const values: typeof importRequests.$inferInsert = {
							id: row.id,
							item,
							requestKey,
							status,
							blockedReason: !item
								? "invalid_item"
								: status === "blocked"
									? existingReservation || dedicatedReservation
										? "legacy_reservation"
										: "legacy_failure"
									: null,
							targetSourceId: row.mediaSourceId,
							createdAt: row.createdAt,
							updatedAt: row.updatedAt,
							approvedAt: status === "approved" ? row.updatedAt : null,
							cancelledAt: status === "cancelled" ? row.updatedAt : null,
						};
						const [inserted] = await db
							.insert(importRequests)
							.values(values)
							.onConflictDoNothing()
							.returning();
						if (!inserted) {
							const [sameId] = await db
								.select({ id: importRequests.id })
								.from(importRequests)
								.where(eq(importRequests.id, row.id));
							if (sameId)
								throw new ResourceConflictError(
									"Legacy import ID conflicts with dedicated state",
								);
							const [existing] = await db
								.select({ id: importRequests.id })
								.from(importRequests)
								.where(
									and(
										eq(importRequests.requestKey, requestKey),
										eq(importRequests.status, "pending"),
									),
								);
							if (status !== "pending" || !existing)
								throw new ResourceConflictError(
									"Legacy import could not be reconciled",
								);
							await db.insert(importRequests).values({
								...values,
								status: "superseded",
								canonicalId: existing.id,
							});
							report.aliases++;
						}
						if (status === "blocked") report.blocked++;
						report.migrated++;
					}
					const last = legacy.at(-1);
					if (!last) break;
					cursor = last.id;
				}
				await db.execute(
					sql`INSERT INTO import_request_legacy_snapshots (request_id, snapshot) SELECT id, to_jsonb(jobs) FROM jobs WHERE type = 'import_request'`,
				);
				await db.delete(jobs).where(eq(jobs.type, "import_request"));
				await db
					.update(importRequestCutovers)
					.set({ authority: "dedicated", generation: 1, updatedAt: sql`NOW()` })
					.where(eq(importRequestCutovers.id, CONTROL_ID));
				return report;
			});
		},
		async rollback() {
			return transactions.transaction(async (tx) => {
				const db = getExecutor(tx);
				const [control] = await db
					.select()
					.from(importRequestCutovers)
					.where(eq(importRequestCutovers.id, CONTROL_ID))
					.for("update");
				if (!control || control.authority !== "dedicated") return 0;
				await db.execute(sql`LOCK TABLE jobs IN SHARE ROW EXCLUSIVE MODE`);
				await db
					.update(importRequestCutovers)
					.set({
						authority: "legacy",
						generation: control.generation + 1,
						updatedAt: sql`NOW()`,
					})
					.where(eq(importRequestCutovers.id, CONTROL_ID));
				const rows = await db
					.select()
					.from(importRequests)
					.orderBy(asc(importRequests.id));
				const snapshots = await db
					.select({ requestId: importRequestLegacySnapshots.requestId })
					.from(importRequestLegacySnapshots);
				const archivedIds = new Set(snapshots.map((row) => row.requestId));
				// Restore complete private legacy rows while projecting their current logical outcome.
				await db.execute(sql`
					INSERT INTO jobs SELECT (restored.record).* FROM (
						SELECT jsonb_populate_record(NULL::jobs,
							archive.snapshot || jsonb_build_object(
								'status', CASE COALESCE(canonical.status, request.status) WHEN 'approved' THEN 'completed' WHEN 'cancelled' THEN 'cancelled' WHEN 'blocked' THEN 'failed' ELSE 'pending' END,
								'source_id', request.target_source_id,
								'updated_at', NOW()
							)) AS record
						FROM import_request_legacy_snapshots AS archive
						JOIN import_requests AS request ON request.id = archive.request_id
						LEFT JOIN import_requests AS canonical ON canonical.id = request.canonical_id
					) AS restored
				`);
				for (const row of rows) {
					if (archivedIds.has(row.id)) continue;
					if (!row.item)
						throw new ResourceConflictError(
							"Native import has no restorable input",
						);
					await db.insert(jobs).values({
						id: row.id,
						type: "import_request",
						mediaSourceId: row.targetSourceId,
						payload: row.item,
						status:
							row.status === "approved"
								? "completed"
								: row.status === "cancelled"
									? "cancelled"
									: row.status === "blocked"
										? "failed"
										: "pending",
						createdAt: row.createdAt,
						updatedAt: new Date(),
					});
				}
				return rows.length;
			});
		},
		async assertDedicated(tx) {
			const [control] = await getExecutor(tx)
				.select()
				.from(importRequestCutovers)
				.where(eq(importRequestCutovers.id, CONTROL_ID))
				.for("share");
			if (control?.authority !== "dedicated")
				throw new ResourceConflictError("Dedicated import writes are disabled");
		},
		async create(items, tx) {
			let created = 0;
			for (const item of items) {
				const input = importItemSchema.parse(item);
				const rows = await getExecutor(tx)
					.insert(importRequests)
					.values({ item: input, requestKey: key(input) })
					.onConflictDoNothing()
					.returning();
				created += rows.length;
			}
			return created;
		},
		async listPending(tx) {
			return (
				await getExecutor(tx)
					.select()
					.from(importRequests)
					.where(eq(importRequests.status, "pending"))
					.orderBy(desc(importRequests.createdAt), desc(importRequests.id))
			).map(map);
		},
		async countPending(tx) {
			const [row] = await getExecutor(tx)
				.select({ total: count() })
				.from(importRequests)
				.where(eq(importRequests.status, "pending"));
			return Number(row?.total ?? 0);
		},
		async lockPending(ids, tx) {
			if (!ids.length) return [];
			const db = getExecutor(tx);
			const aliases = await db
				.select({ canonicalId: importRequests.canonicalId })
				.from(importRequests)
				.where(
					and(
						inArray(importRequests.id, ids),
						eq(importRequests.status, "superseded"),
					),
				);
			const candidates = [
				...new Set([
					...ids,
					...aliases.flatMap((row) =>
						row.canonicalId ? [row.canonicalId] : [],
					),
				]),
			];
			return (
				await db
					.select()
					.from(importRequests)
					.where(
						and(
							inArray(importRequests.id, candidates),
							eq(importRequests.status, "pending"),
						),
					)
					.orderBy(asc(importRequests.id))
					.for("update")
			).map(map);
		},
		async approve(ids, sourceId, tx) {
			if (ids.length)
				await getExecutor(tx)
					.update(importRequests)
					.set({
						status: "approved",
						targetSourceId: sourceId,
						approvedAt: sql`NOW()`,
						updatedAt: sql`NOW()`,
					})
					.where(
						and(
							inArray(importRequests.id, ids),
							eq(importRequests.status, "pending"),
						),
					);
		},
		async cancel(ids, tx) {
			if (ids.length)
				await getExecutor(tx)
					.update(importRequests)
					.set({
						status: "cancelled",
						cancelledAt: sql`NOW()`,
						updatedAt: sql`NOW()`,
					})
					.where(
						and(
							inArray(importRequests.id, ids),
							eq(importRequests.status, "pending"),
						),
					);
		},
	};
}
