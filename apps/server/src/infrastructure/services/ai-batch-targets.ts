import {
	CCIP_EMBEDDING_VERSION,
	CCIP_MODEL,
} from "@solid-imager/application/services/ccip-vector-service";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { and, eq, notExists, sql } from "drizzle-orm";
import {
	ccipEmbeddings,
	mediaCharacters,
	mediaIps,
	mediaRegions,
	mediaSources,
	medias,
	mediaTags,
} from "~/infrastructure/db/schema";

type ScanInput = { mediaSourceId?: string; force?: boolean };

export async function countTaggingTargets(
	database: DrizzleExecutor,
	input: ScanInput,
): Promise<number> {
	const [row] = await database
		.select({ count: sql<number>`count(*)` })
		.from(medias)
		.where(
			and(
				eq(medias.mediaType, "image"),
				input.mediaSourceId
					? eq(medias.mediaSourceId, input.mediaSourceId)
					: undefined,
				input.force
					? undefined
					: and(
							...[mediaTags, mediaCharacters, mediaIps].map((table) =>
								notExists(
									database
										.select({ exists: sql`1` })
										.from(table)
										.where(
											and(eq(table.mediaId, medias.id), eq(table.source, "AI")),
										),
								),
							),
						),
			),
		);
	return Number(row?.count ?? 0);
}

export async function countCcipTargets(
	database: DrizzleExecutor,
	input: ScanInput,
): Promise<number> {
	const [row] = await database
		.select({ count: sql<number>`count(*)` })
		.from(medias)
		.innerJoin(mediaSources, eq(mediaSources.id, medias.mediaSourceId))
		.where(
			and(
				eq(medias.mediaType, "image"),
				eq(mediaSources.type, "local"),
				input.mediaSourceId
					? eq(medias.mediaSourceId, input.mediaSourceId)
					: undefined,
				input.force
					? undefined
					: notExists(
							database
								.select({ exists: sql`1` })
								.from(mediaRegions)
								.innerJoin(
									ccipEmbeddings,
									eq(ccipEmbeddings.regionId, mediaRegions.id),
								)
								.where(
									and(
										eq(mediaRegions.mediaId, medias.id),
										eq(mediaRegions.kind, "full"),
										eq(ccipEmbeddings.model, CCIP_MODEL),
										eq(ccipEmbeddings.embeddingVersion, CCIP_EMBEDDING_VERSION),
										// Match the previous JS Date.getTime() comparison precision.
										sql`date_trunc('milliseconds', ${ccipEmbeddings.mediaModifiedAt}) = date_trunc('milliseconds', ${medias.modifiedAt})`,
									),
								),
						),
			),
		);
	return Number(row?.count ?? 0);
}
