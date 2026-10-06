import { randomUUID } from "node:crypto";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	mediaProcessingStateSchema,
	mediaProcessingRequestSchema,
	scheduledMediaInputSchema,
	MediaProcessingScheduledError,
	MediaProcessingSupersededError,
	serializeMediaProcessingInput,
	type MediaProcessingInput,
	type MediaProcessingClaim,
	type MediaProcessingState,
} from "@solid-imager/core/domain/processing/schemas";
import type { IMediaProcessingSchedulerRepository } from "@solid-imager/core/domain/repositories/media-processing-state-repository";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { taggingResponseSchema } from "@solid-imager/core/domain/tagging/schemas";
import { and, eq, inArray, sql, asc, lt } from "drizzle-orm";
import {
	mediaProcessingStates as states,
	medias,
	mediaSources,
	jobs,
} from "../schema";
import type { DrizzleExecutor } from "../types";

export const MEDIA_PROCESSING_LEASE_MS = 120_000;
// Schema timestamps are UTC without time zone. Dedicated scheduling uses DB time.
const dbNow = sql`timezone('UTC', clock_timestamp())`;
const leaseAlive = sql`${states.heartbeatAt} > ${dbNow} - ${MEDIA_PROCESSING_LEASE_MS} * interval '1 millisecond'`;
const retryAt = sql`${dbNow} + least(300000, 1000 * power(2, least(${states.attemptCount} - 1, 20)) * (0.75 + random() * 0.5)) * interval '1 millisecond'`;

function mapState(row: typeof states.$inferSelect): MediaProcessingState {
	return mediaProcessingStateSchema.parse({
		mediaId: row.mediaId,
		taskKind: row.taskKind,
		status: row.status,
		inputRevision: row.inputRevision,
		requestedRevision: row.requestedRevision,
		completedRevision: row.completedRevision,
		claimToken: row.claimToken,
		claimedAt: row.claimedAt,
		heartbeatAt: row.heartbeatAt,
		attemptCount: row.attemptCount,
		executionMode: row.executionMode,
		availableAt: row.availableAt,
		maxAttempts: row.maxAttempts,
		ownerJobId: row.ownerJobId,
		ownerAttemptCount: row.ownerAttemptCount,
		lastError: row.lastError,
		updatedAt: row.updatedAt,
	});
}
const clearedClaim = {
	claimToken: null,
	claimedAt: null,
	heartbeatAt: null,
	ownerJobId: null,
	ownerAttemptCount: null,
};
function claimCondition(claim: MediaProcessingClaim) {
	return and(
		eq(states.mediaId, claim.mediaId),
		eq(states.taskKind, claim.taskKind),
		eq(states.status, "in_progress"),
		eq(states.requestedRevision, claim.revision),
		eq(states.claimToken, claim.token),
		sql`(${states.executionMode} <> 'scheduled' OR ${leaseAlive})`,
	);
}

export function createMediaProcessingStateRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): IMediaProcessingSchedulerRepository {
	async function lockInput(input: MediaProcessingInput, tx: Transaction) {
		if (!tx) throw new Error("Processing state requires a transaction");
		const db = getExecutor(tx);
		const [media] = await db
			.select()
			.from(medias)
			.where(eq(medias.id, input.mediaId))
			.for("update");
		const [source] = await db
			.select()
			.from(mediaSources)
			.where(eq(mediaSources.id, input.mediaSourceId))
			.for("share");
		const connection = localConnectionSchema.safeParse(source?.connectionInfo);
		if (
			!media ||
			source?.type !== "local" ||
			!connection.success ||
			media.mediaSourceId !== input.mediaSourceId ||
			media.mediaType !== input.mediaType ||
			serializeMediaProcessingInput({
				...input,
				mediaSourceId: media.mediaSourceId,
				sourcePath: connection.data.path,
				filePath: media.filePath,
				fileSize: media.fileSize,
				modifiedAt: media.modifiedAt,
			}) !== serializeMediaProcessingInput(input)
		) {
			throw new MediaProcessingSupersededError();
		}
	}
	return {
		async request(request, tx) {
			const { input, taskKind, revision, maxAttempts, force } =
				mediaProcessingRequestSchema.parse(request);
			await lockInput(input, tx);
			const db = getExecutor(tx);
			const [previous] = await db
				.select()
				.from(states)
				.where(
					and(eq(states.mediaId, input.mediaId), eq(states.taskKind, taskKind)),
				)
				.for("update");
			if (
				previous?.executionMode === "scheduled" &&
				previous.requestedRevision === revision &&
				(!force ||
					previous.status === "pending" ||
					previous.status === "in_progress")
			)
				return mapState(previous);
			const values = {
				...clearedClaim,
				mediaId: input.mediaId,
				taskKind,
				requestedRevision: revision,
				inputRevision: serializeMediaProcessingInput(input),
				scheduledInput: {
					...input,
					modifiedAt: input.modifiedAt.toISOString(),
				},
				executionMode: "scheduled",
				status: "pending",
				attemptCount: 0,
				maxAttempts,
				availableAt: dbNow,
				updatedAt: dbNow,
				lastError: null,
				taggingResult: null,
				completedRevision: previous?.completedRevision ?? null,
			};
			const [row] = await db
				.insert(states)
				.values(values)
				.onConflictDoUpdate({
					target: [states.mediaId, states.taskKind],
					set: values,
				})
				.returning();
			return mapState(row);
		},
		async claimDue(taskKinds, tx) {
			if (!taskKinds.length) return null;
			if (!tx) throw new Error("Processing claim requires a transaction");
			const db = getExecutor(tx);
			const due = and(
				eq(states.executionMode, "scheduled"),
				eq(states.status, "pending"),
				inArray(states.taskKind, taskKinds),
				lt(states.attemptCount, states.maxAttempts),
				sql`${states.availableAt} <= ${dbNow}`,
			);
			// All request/commit/claim paths lock media before state. Locking state first would deadlock.
			const [candidate] = await db
				.select({ mediaId: states.mediaId, taskKind: states.taskKind })
				.from(states)
				.innerJoin(medias, eq(medias.id, states.mediaId))
				.where(due)
				.orderBy(
					asc(states.availableAt),
					asc(states.mediaId),
					asc(states.taskKind),
				)
				.limit(1)
				.for("update", { of: medias, skipLocked: true });
			if (!candidate) return null;
			const [row] = await db
				.select()
				.from(states)
				.where(
					and(
						due,
						eq(states.mediaId, candidate.mediaId),
						eq(states.taskKind, candidate.taskKind),
					),
				)
				.for("update");
			if (!row) return null;
			const parsed = scheduledMediaInputSchema.safeParse(row.scheduledInput);
			if (
				!parsed.success ||
				parsed.data.mediaId !== row.mediaId ||
				serializeMediaProcessingInput({
					...parsed.data,
					modifiedAt: new Date(parsed.data.modifiedAt),
				}) !== row.inputRevision
			) {
				await db
					.update(states)
					.set({
						status: "failed",
						lastError: "Invalid scheduled media input",
						updatedAt: dbNow,
					})
					.where(
						and(
							eq(states.mediaId, row.mediaId),
							eq(states.taskKind, row.taskKind),
						),
					);
				return null;
			}
			const snapshot = parsed.data;
			const input = { ...snapshot, modifiedAt: new Date(snapshot.modifiedAt) };
			try {
				await lockInput(input, tx);
			} catch (error) {
				if (!(error instanceof MediaProcessingSupersededError)) throw error;
				await db
					.update(states)
					.set({
						status: "failed",
						lastError: "Requested media input has changed",
						updatedAt: dbNow,
					})
					.where(
						and(
							eq(states.mediaId, row.mediaId),
							eq(states.taskKind, row.taskKind),
						),
					);
				return null;
			}
			const token = randomUUID();
			const [claimed] = await db
				.update(states)
				.set({
					status: "in_progress",
					claimToken: token,
					claimedAt: dbNow,
					heartbeatAt: dbNow,
					updatedAt: dbNow,
					attemptCount: sql`${states.attemptCount} + 1`,
				})
				.where(
					and(
						due,
						eq(states.mediaId, row.mediaId),
						eq(states.taskKind, row.taskKind),
					),
				)
				.returning();
			if (!claimed) return null;
			const state = mapState(claimed);
			return {
				input,
				state,
				claim: {
					mediaId: state.mediaId,
					taskKind: state.taskKind,
					revision: state.requestedRevision,
					token,
				},
			};
		},
		async recoverExpired(taskKinds, limit, tx) {
			if (!taskKinds.length) return 0;
			if (!tx || !Number.isInteger(limit) || limit < 1 || limit > 1000)
				throw new Error("Invalid processing recovery transaction or limit");
			const db = getExecutor(tx);
			const expired = and(
				eq(states.executionMode, "scheduled"),
				eq(states.status, "in_progress"),
				inArray(states.taskKind, taskKinds),
				sql`NOT (${leaseAlive})`,
			);
			const candidates = await db
				.select({ mediaId: states.mediaId, taskKind: states.taskKind })
				.from(states)
				.innerJoin(medias, eq(medias.id, states.mediaId))
				.where(expired)
				.orderBy(
					asc(states.heartbeatAt),
					asc(states.mediaId),
					asc(states.taskKind),
				)
				.limit(limit)
				.for("update", { of: medias, skipLocked: true });
			let recovered = 0;
			for (const candidate of candidates) {
				const rows = await db
					.update(states)
					.set({
						...clearedClaim,
						status: sql`CASE WHEN ${states.attemptCount} < ${states.maxAttempts} THEN 'pending' ELSE 'failed' END`,
						availableAt: retryAt,
						lastError: "Processing lease expired",
						updatedAt: dbNow,
					})
					.where(
						and(
							expired,
							eq(states.mediaId, candidate.mediaId),
							eq(states.taskKind, candidate.taskKind),
						),
					)
					.returning();
				recovered += rows.length;
			}
			return recovered;
		},
		async settleFailure(claim, error, retryable, tx) {
			if (!tx) throw new Error("Processing settlement requires a transaction");
			const [row] = await getExecutor(tx)
				.update(states)
				.set({
					...clearedClaim,
					status: retryable
						? sql`CASE WHEN ${states.attemptCount} < ${states.maxAttempts} THEN 'pending' ELSE 'failed' END`
						: "failed",
					availableAt: retryable ? retryAt : dbNow,
					lastError: error.slice(0, 2048),
					updatedAt: dbNow,
				})
				.where(
					and(claimCondition(claim), eq(states.executionMode, "scheduled")),
				)
				.returning();
			return row ? mapState(row) : null;
		},
		async findTaggingResult(mediaId, revision, tx) {
			const [row] = await getExecutor(tx)
				.select({ result: states.taggingResult })
				.from(states)
				.where(
					and(
						eq(states.mediaId, mediaId),
						eq(states.taskKind, "tagging"),
						eq(states.status, "completed"),
						eq(states.requestedRevision, revision),
						eq(states.completedRevision, revision),
					),
				);
			const parsed = taggingResponseSchema.safeParse(row?.result);
			return parsed.success ? parsed.data : null;
		},
		async saveTaggingResult(claim, result, tx) {
			if (claim.taskKind !== "tagging")
				throw new Error("Tagging result requires a tagging claim");
			const rows = await getExecutor(tx)
				.update(states)
				.set({ taggingResult: taggingResponseSchema.parse(result) })
				.where(claimCondition(claim))
				.returning();
			if (!rows.length) throw new MediaProcessingSupersededError();
		},
		async findByMediaIds(ids) {
			if (!ids.length) return [];
			return (
				await getExecutor()
					.select()
					.from(states)
					.where(inArray(states.mediaId, ids))
			).map(mapState);
		},
		async claim(input, taskKind, revision, owner, force, tx) {
			await lockInput(input, tx);
			const db = getExecutor(tx);
			const where = and(
				eq(states.mediaId, input.mediaId),
				eq(states.taskKind, taskKind),
			);
			const [previous] = await db.select().from(states).where(where);
			if (previous?.executionMode === "scheduled")
				throw new MediaProcessingScheduledError();
			const now = new Date();
			if (previous?.requestedRevision === revision) {
				if (previous.status === "completed" && !force)
					return { status: "completed", state: mapState(previous) };
				if (
					previous.status === "in_progress" &&
					previous.heartbeatAt &&
					now.getTime() - previous.heartbeatAt.getTime() <
						MEDIA_PROCESSING_LEASE_MS
				) {
					let active = true;
					if (previous.ownerJobId) {
						const [job] = await db
							.select({
								status: jobs.status,
								attempt: jobs.attemptCount,
								cancel: jobs.cancelRequestedAt,
							})
							.from(jobs)
							.where(eq(jobs.id, previous.ownerJobId));
						active =
							!!job &&
							job.status === "in_progress" &&
							job.attempt === previous.ownerAttemptCount &&
							job.cancel === null;
					}
					if (active) return { status: "busy" };
				}
			}
			const token = randomUUID();
			const values = {
				mediaId: input.mediaId,
				taskKind,
				status: "in_progress",
				inputRevision: serializeMediaProcessingInput(input),
				requestedRevision: revision,
				completedRevision: previous?.completedRevision ?? null,
				claimToken: token,
				claimedAt: now,
				heartbeatAt: now,
				updatedAt: now,
				attemptCount:
					previous?.requestedRevision === revision
						? previous.attemptCount + 1
						: 1,
				ownerJobId: owner?.jobId ?? null,
				ownerAttemptCount: owner?.attemptCount ?? null,
				lastError: null,
				taggingResult: null,
			};
			const [row] = await db
				.insert(states)
				.values(values)
				.onConflictDoUpdate({
					target: [states.mediaId, states.taskKind],
					set: values,
				})
				.returning();
			return {
				status: "claimed",
				claim: { mediaId: input.mediaId, taskKind, revision, token },
				state: mapState(row),
			};
		},
		async commit(input, claim, output, tx) {
			if (input.mediaId !== claim.mediaId)
				throw new MediaProcessingSupersededError();
			await lockInput(input, tx);
			const db = getExecutor(tx);
			const [state] = await db
				.select()
				.from(states)
				.where(claimCondition(claim))
				.for("update");
			if (!state) throw new MediaProcessingSupersededError();
			await output(tx);
			const completed = await db
				.update(states)
				.set({
					...clearedClaim,
					status: "completed",
					completedRevision: claim.revision,
					lastError: null,
					updatedAt: dbNow,
				})
				.where(claimCondition(claim))
				.returning();
			if (!completed.length) throw new MediaProcessingSupersededError();
		},
		async fail(claim, error, tx) {
			const rows = await getExecutor(tx)
				.update(states)
				.set({
					...clearedClaim,
					status: "failed",
					lastError: error.slice(0, 2048),
					updatedAt: new Date(),
				})
				.where(claimCondition(claim))
				.returning();
			return rows.length > 0;
		},
		async heartbeat(claim) {
			const rows = await getExecutor()
				.update(states)
				.set({ heartbeatAt: dbNow, updatedAt: dbNow })
				.where(claimCondition(claim))
				.returning();
			return rows.length > 0;
		},
	};
}
