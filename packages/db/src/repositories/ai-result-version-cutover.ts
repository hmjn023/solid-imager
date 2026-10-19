import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	serializeMediaProcessingInput,
	type AiTaskKind,
	type MediaProcessingInput,
} from "@solid-imager/core/domain/processing/schemas";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { taggingResponseSchema } from "@solid-imager/core/domain/tagging/schemas";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import {
	medias,
	mediaSources,
	mediaProcessingStates as states,
	mediaRegions,
	ccipEmbeddings,
	batchItems,
	batchItemAttempts,
} from "../schema";
import { createTransactionManager } from "../transaction-manager";
import type { DrizzleExecutor } from "../types";

/** Only legacy revisions are bare hashes; versioned revisions are namespaced. */
const legacyRevision = sql`${states.requestedRevision} ~ '^[0-9a-f]{64}$'`;

/** Run before workers start, with old-version writers stopped. Each result is adopted atomically. */
export async function migrateLegacyAiResults(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
	baseline: {
		revision(input: MediaProcessingInput, kind: AiTaskKind): string;
		ccipModel: string;
		ccipEmbeddingVersion: number;
	},
): Promise<number> {
	const transactions = createTransactionManager(() => getExecutor());
	let migrated = 0;
	for (const kind of ["tagging", "ccip"] as const) {
		let cursor: string | undefined;
		for (;;) {
			const page = await getExecutor()
				.select({ id: states.mediaId })
				.from(states)
				.where(
					and(
						eq(states.taskKind, kind),
						eq(states.status, "completed"),
						legacyRevision,
						cursor ? gt(states.mediaId, cursor) : undefined,
					),
				)
				.orderBy(asc(states.mediaId))
				.limit(100);
			if (!page.length) break;
			for (const { id } of page) {
				migrated += await transactions.transaction(async (tx) => {
					const db = getExecutor(tx);
					const [media] = await db
						.select()
						.from(medias)
						.where(eq(medias.id, id))
						.for("update");
					if (!media || media.mediaType !== "image") return 0;
					const [source] = await db
						.select()
						.from(mediaSources)
						.where(eq(mediaSources.id, media.mediaSourceId))
						.for("share");
					const connection = localConnectionSchema.safeParse(
						source?.connectionInfo,
					);
					if (source?.type !== "local" || !connection.success) return 0;
					const [state] = await db
						.select()
						.from(states)
						.where(
							and(
								eq(states.mediaId, id),
								eq(states.taskKind, kind),
								eq(states.status, "completed"),
								legacyRevision,
							),
						)
						.for("update");
					if (!state || state.completedRevision !== state.requestedRevision)
						return 0;
					const input: MediaProcessingInput = {
						mediaId: media.id,
						mediaSourceId: media.mediaSourceId,
						mediaType: media.mediaType,
						sourcePath: connection.data.path,
						filePath: media.filePath,
						modifiedAt: media.modifiedAt,
						fileSize: media.fileSize,
					};
					if (state.inputRevision !== serializeMediaProcessingInput(input))
						return 0;
					const revision = baseline.revision(input, kind);
					if (kind === "tagging") {
						if (!taggingResponseSchema.safeParse(state.taggingResult).success)
							return 0;
					} else {
						const [vector] = await db
							.select({ id: ccipEmbeddings.id })
							.from(ccipEmbeddings)
							.innerJoin(
								mediaRegions,
								eq(mediaRegions.id, ccipEmbeddings.regionId),
							)
							.where(
								and(
									eq(mediaRegions.mediaId, id),
									eq(mediaRegions.kind, "full"),
									eq(ccipEmbeddings.model, baseline.ccipModel),
									eq(
										ccipEmbeddings.embeddingVersion,
										baseline.ccipEmbeddingVersion,
									),
									eq(ccipEmbeddings.mediaModifiedAt, input.modifiedAt),
									eq(
										ccipEmbeddings.processingRevision,
										state.requestedRevision,
									),
								),
							)
							.for("update", { of: ccipEmbeddings });
						if (!vector) return 0;
						await db
							.update(ccipEmbeddings)
							.set({ processingRevision: revision })
							.where(eq(ccipEmbeddings.id, vector.id));
					}
					await db
						.update(states)
						.set({ requestedRevision: revision, completedRevision: revision })
						.where(and(eq(states.mediaId, id), eq(states.taskKind, kind)));
					// Preserve observers of this completed request, including unsettled batch items.
					await db
						.update(batchItems)
						.set({ plannedRevision: revision, requestedRevision: revision })
						.where(
							and(
								eq(batchItems.requestId, state.requestId),
								eq(batchItems.kind, kind),
								eq(batchItems.requestedRevision, state.requestedRevision),
								inArray(batchItems.status, ["pending", "scheduled"]),
							),
						);
					await db
						.update(batchItemAttempts)
						.set({ requestedRevision: revision })
						.where(
							and(
								eq(batchItemAttempts.requestId, state.requestId),
								eq(
									batchItemAttempts.requestedRevision,
									state.requestedRevision,
								),
								inArray(batchItemAttempts.status, ["pending", "scheduled"]),
							),
						);
					return 1;
				});
			}
			cursor = page.at(-1)?.id;
		}
	}
	return migrated;
}
