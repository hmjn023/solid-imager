import { randomUUID } from "node:crypto";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	mediaProcessingStateSchema,
	MediaProcessingSupersededError,
	serializeMediaProcessingInput,
	type MediaProcessingInput,
	type MediaProcessingClaim,
	type MediaProcessingState,
} from "@solid-imager/core/domain/processing/schemas";
import type { IMediaProcessingStateRepository } from "@solid-imager/core/domain/repositories/media-processing-state-repository";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { and, eq, inArray } from "drizzle-orm";
import {
	mediaProcessingStates as states,
	medias,
	mediaSources,
	jobs,
} from "../schema";
import type { DrizzleExecutor } from "../types";

export const MEDIA_PROCESSING_LEASE_MS = 120_000;

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
	);
}

export function createMediaProcessingStateRepository(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
): IMediaProcessingStateRepository {
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
			await db
				.update(states)
				.set({
					...clearedClaim,
					status: "completed",
					completedRevision: claim.revision,
					lastError: null,
					updatedAt: new Date(),
				})
				.where(claimCondition(claim));
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
				.set({ heartbeatAt: new Date(), updatedAt: new Date() })
				.where(claimCondition(claim))
				.returning();
			return rows.length > 0;
		},
	};
}
