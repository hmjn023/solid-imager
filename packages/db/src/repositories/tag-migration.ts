import { ResourceConflictError } from "@solid-imager/core/errors";
import { eq, inArray, or, sql } from "drizzle-orm";
import {
	mediaTags,
	relatedTagFrequencies,
	tagNameRedirects,
	tags,
} from "../schema";
import type { DrizzleExecutor } from "../types";

// Existing tag writers share this lock while resolving names and adding assignments.
const TAG_MIGRATION_LOCK = 621744;

export async function lockTagNames(db: DrizzleExecutor, shared: boolean) {
	await db.execute(
		shared
			? sql`select pg_advisory_xact_lock_shared(${TAG_MIGRATION_LOCK})`
			: sql`select pg_advisory_xact_lock(${TAG_MIGRATION_LOCK})`,
	);
}

export async function resolveTagNameRedirects(
	db: DrizzleExecutor,
	names: string[],
) {
	if (names.length === 0)
		return new Map<string, { id: string; name: string }>();
	const rows = await db
		.select({ oldName: tagNameRedirects.name, id: tags.id, name: tags.name })
		.from(tagNameRedirects)
		.innerJoin(tags, eq(tagNameRedirects.tagId, tags.id))
		.where(inArray(tagNameRedirects.name, [...new Set(names)]));
	return new Map(rows.map(({ oldName, id, name }) => [oldName, { id, name }]));
}

export async function assertTagIdsExist(db: DrizzleExecutor, tagIds: string[]) {
	await lockTagNames(db, true);
	const unique = [...new Set(tagIds)];
	const rows = await db
		.select({ id: tags.id })
		.from(tags)
		.where(inArray(tags.id, unique))
		.orderBy(tags.id)
		.for("key share");
	if (rows.length !== unique.length) {
		throw new ResourceConflictError(
			"One or more tags changed. Reload the tags and try again.",
		);
	}
}

export async function mergeTag(
	db: DrizzleExecutor,
	legacy: { id: string; name: string },
	destination: string,
) {
	const redirects = await resolveTagNameRedirects(db, [destination]);
	const targetName = redirects.get(destination)?.name ?? destination;
	const rows = await db
		.select()
		.from(tags)
		.where(or(eq(tags.id, legacy.id), eq(tags.name, targetName)))
		.orderBy(tags.id)
		.for("update");
	const source = rows.find((row) => row.id === legacy.id);
	if (source?.name !== legacy.name || source.name === targetName) return false;
	const target = rows.find((row) => row.name === targetName);
	const tagId = target?.id ?? source.id;

	if (!target) {
		await db
			.update(tags)
			.set({ name: targetName, updatedAt: new Date() })
			.where(eq(tags.id, source.id));
	} else {
		await db
			.update(tags)
			.set({
				description: target.description ?? source.description,
				attribute: target.attribute ?? source.attribute,
				color: target.color ?? source.color,
				authorId: target.authorId ?? source.authorId,
				updatedAt: new Date(),
			})
			.where(eq(tags.id, target.id));
		await db.execute(sql`
			insert into ${mediaTags} (media_id, tag_id, tag_type, confidence, source)
			select media_id, ${target.id}, tag_type, confidence, source
			from ${mediaTags} where tag_id = ${source.id}
			order by media_id, tag_type
			on conflict (media_id, tag_id, tag_type) do update
			set confidence = excluded.confidence, source = excluded.source
			where (excluded.source = 'manual' and ${mediaTags.source} <> 'manual')
				or ((excluded.source = 'manual') = (${mediaTags.source} = 'manual')
					and coalesce(excluded.confidence, 1) > coalesce(${mediaTags.confidence}, 1))
		`);
		await db
			.update(tagNameRedirects)
			.set({ tagId })
			.where(eq(tagNameRedirects.tagId, source.id));
		await db.delete(tags).where(eq(tags.id, source.id));
		await db
			.delete(relatedTagFrequencies)
			.where(eq(relatedTagFrequencies.tagId, source.id));
	}
	await db
		.insert(tagNameRedirects)
		.values({ name: source.name, tagId })
		.onConflictDoUpdate({ target: tagNameRedirects.name, set: { tagId } });
	return true;
}
