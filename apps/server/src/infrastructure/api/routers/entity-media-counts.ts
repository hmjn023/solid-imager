import { and, count, eq, inArray, ne } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import {
	mediaCharacters,
	mediaIps,
	mediaProjects,
	medias,
} from "~/infrastructure/db/schema";

export async function getProjectMediaCounts(
	ids: string[],
): Promise<Map<string, number>> {
	if (ids.length === 0) return new Map();
	const rows = await db
		.select({ id: mediaProjects.projectId, mediaCount: count() })
		.from(mediaProjects)
		.where(inArray(mediaProjects.projectId, ids))
		.groupBy(mediaProjects.projectId);
	return new Map(rows.map((row) => [row.id, Number(row.mediaCount)] as const));
}

export async function getIpMediaCounts(
	ids: string[],
): Promise<Map<string, number>> {
	if (ids.length === 0) return new Map();
	const rows = await db
		.select({ id: mediaIps.ipId, mediaCount: count() })
		.from(mediaIps)
		.innerJoin(medias, eq(medias.id, mediaIps.mediaId))
		.where(and(inArray(mediaIps.ipId, ids), ne(medias.status, "deleted")))
		.groupBy(mediaIps.ipId);
	return new Map(rows.map((row) => [row.id, Number(row.mediaCount)] as const));
}

export async function getCharacterMediaCounts(
	ids: string[],
): Promise<Map<string, number>> {
	if (ids.length === 0) return new Map();
	const rows = await db
		.select({ id: mediaCharacters.characterId, mediaCount: count() })
		.from(mediaCharacters)
		.innerJoin(medias, eq(medias.id, mediaCharacters.mediaId))
		.where(
			and(
				inArray(mediaCharacters.characterId, ids),
				ne(medias.status, "deleted"),
			),
		)
		.groupBy(mediaCharacters.characterId);
	return new Map(rows.map((row) => [row.id, Number(row.mediaCount)] as const));
}
