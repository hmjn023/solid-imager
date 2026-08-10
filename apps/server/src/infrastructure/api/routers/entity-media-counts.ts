import { count, inArray } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import {
	mediaCharacters,
	mediaIps,
	mediaProjects,
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
		.where(inArray(mediaIps.ipId, ids))
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
		.where(inArray(mediaCharacters.characterId, ids))
		.groupBy(mediaCharacters.characterId);
	return new Map(rows.map((row) => [row.id, Number(row.mediaCount)] as const));
}
