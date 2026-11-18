import {
	canonicalTagName,
	normalizeTagDictionaryQuery,
	TAG_DICTIONARY_JOB,
	TAG_DICTIONARY_PAGE_SIZE,
	tagDictionaryStatusSchema,
	type TagDictionaryRepository,
} from "@solid-imager/core/tags";
import {
	and,
	count as countRows,
	desc,
	eq,
	isNull,
	notExists,
	sql,
} from "drizzle-orm";
import {
	jobs,
	tagDictionaryAttributes as attributes,
	tagDictionarySnapshots as snapshots,
	tagDictionaryTags as tags,
	tagDictionaryWiki as wiki,
	tags as libraryTags,
} from "../schema";
import type { DrizzleExecutor } from "../types";
import { lockTagNames, mergeTag } from "./tag-migration";

const summaryFields = {
	name: tags.name,
	category: tags.category,
	postCount: tags.postCount,
	japanese: tags.japanese,
	aliases: tags.aliases,
	wikiNames: wiki.otherNames,
	attributes: attributes.attributes,
};
const LEGACY_MIGRATION_BATCH_SIZE = 30;

async function assertRefreshAttempt(
	db: DrizzleExecutor,
	attempt: { id: string; number: number },
) {
	const [owner] = await db
		.select({ id: jobs.id })
		.from(jobs)
		.where(
			and(
				eq(jobs.id, attempt.id),
				eq(jobs.attemptCount, attempt.number),
				eq(jobs.status, "in_progress"),
				isNull(jobs.cancelRequestedAt),
			),
		)
		.for("update");
	if (!owner) throw new Error("Tag dictionary refresh attempt ended");
}

export function createTagDictionaryRepository(
	db: () => DrizzleExecutor,
): TagDictionaryRepository {
	return {
		async status() {
			const versions = await db()
				.select()
				.from(snapshots)
				.orderBy(snapshots.source);
			const [job] = await db()
				.select({
					id: jobs.id,
					status: jobs.status,
					error: jobs.error,
					updatedAt: jobs.updatedAt,
					// Job completion uses database-local NOW() on a timestamp without a time zone.
					finishedAtUtc: sql<string | null>`to_char(
					${jobs.finishedAt} AT TIME ZONE current_setting('TimeZone') AT TIME ZONE 'UTC',
					'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
				)`,
				})
				.from(jobs)
				.where(eq(jobs.type, TAG_DICTIONARY_JOB))
				.orderBy(
					sql`case when ${jobs.status} in ('pending', 'in_progress') then 0 else 1 end`,
					desc(jobs.updatedAt),
					desc(jobs.id),
				)
				.limit(1);
			return tagDictionaryStatusSchema.parse({
				snapshots: versions.map((row) => ({
					...row,
					installedAt: row.installedAt.toISOString(),
				})),
				job: job
					? {
							id: job.id,
							status: job.status,
							error: job.error?.startsWith("Tag dictionary refresh failed: ")
								? job.error
								: null,
							updatedAt: job.finishedAtUtc ?? job.updatedAt.toISOString(),
						}
					: null,
			});
		},

		async search({ query, category, offset }) {
			const term = normalizeTagDictionaryQuery(query);
			const name = canonicalTagName(query);
			const rows = await db()
				.select(summaryFields)
				.from(tags)
				.leftJoin(wiki, eq(wiki.name, tags.name))
				.leftJoin(attributes, eq(attributes.name, tags.name))
				.where(
					and(
						category === undefined ? undefined : eq(tags.category, category),
						query
							? sql`(
						${tags.name} = ${name}
						or (${term} <> '' and strpos(${tags.searchText}, ${term}) > 0)
					)`
							: undefined,
					),
				)
				.orderBy(
					...(query
						? [
								sql`case when ${tags.name} = ${name} then 0
						when starts_with(${tags.name}, ${name}) then 1 else 2 end`,
							]
						: []),
					desc(tags.postCount),
					tags.name,
				)
				.limit(TAG_DICTIONARY_PAGE_SIZE + 1)
				.offset(offset);
			return {
				items: rows.slice(0, TAG_DICTIONARY_PAGE_SIZE).map((row) => ({
					...row,
					wikiNames: row.wikiNames ?? [],
					attributes: row.attributes ?? [],
				})),
				hasMore: rows.length > TAG_DICTIONARY_PAGE_SIZE,
			};
		},

		async detail(name) {
			const [row] = await db()
				.select({
					...summaryFields,
					body: wiki.body,
					wikiUpdatedAt: wiki.updatedAt,
				})
				.from(tags)
				.leftJoin(wiki, eq(wiki.name, tags.name))
				.leftJoin(attributes, eq(attributes.name, tags.name))
				.where(sql`${tags.name} = coalesce(
					(select name from ${tags} where name = ${name}),
					(select min(name) from ${tags}
						where aliases @> jsonb_build_array(${name}::text)
						having count(*) = 1)
				)`);
			return row
				? {
						...row,
						wikiNames: row.wikiNames ?? [],
						attributes: row.attributes ?? [],
						wikiSource: row.wikiUpdatedAt ? "snapshot" : null,
					}
				: null;
		},

		async listLegacy({ query, offset }) {
			const exec = db();
			const rows = await exec
				.select({ id: libraryTags.id, name: libraryTags.name })
				.from(libraryTags)
				.where(
					and(
						notExists(
							exec
								.select({ name: tags.name })
								.from(tags)
								.where(eq(tags.name, libraryTags.name)),
						),
						query
							? sql`strpos(lower(${libraryTags.name}), ${query.toLowerCase()}) > 0`
							: undefined,
					),
				)
				.orderBy(libraryTags.name)
				.limit(TAG_DICTIONARY_PAGE_SIZE + 1)
				.offset(offset);
			return {
				items: rows.slice(0, TAG_DICTIONARY_PAGE_SIZE),
				hasMore: rows.length > TAG_DICTIONARY_PAGE_SIZE,
			};
		},

		async migrateLegacy({ tagId, sourceName, target }) {
			return db().transaction(async (tx) => {
				await lockTagNames(tx, false);
				const [destination] = await tx
					.select({ name: tags.name })
					.from(tags)
					.where(eq(tags.name, target))
					.for("key share");
				if (!destination) return false;
				const [canonical] = await tx
					.select({ name: tags.name })
					.from(tags)
					.where(eq(tags.name, sourceName));
				return (
					!canonical &&
					(await mergeTag(
						tx,
						{ id: tagId, name: sourceName },
						destination.name,
					))
				);
			});
		},

		async reconcileLegacy(attempt) {
			const exec = db();
			const candidates = await exec
				.select({
					id: libraryTags.id,
					name: libraryTags.name,
					target: sql<string>`min(dictionary.name)`,
				})
				.from(libraryTags)
				.innerJoin(
					sql`(
						select name, jsonb_array_elements_text(aliases) as alias
						from ${tags} where jsonb_array_length(aliases) > 0
					) dictionary`,
					sql`dictionary.alias = ${libraryTags.name}`,
				)
				.where(
					notExists(
						exec
							.select({ name: tags.name })
							.from(tags)
							.where(eq(tags.name, libraryTags.name)),
					),
				)
				.groupBy(libraryTags.id)
				.having(sql`count(distinct dictionary.name) = 1`)
				.orderBy(libraryTags.id);
			for (
				let offset = 0;
				offset < candidates.length;
				offset += LEGACY_MIGRATION_BATCH_SIZE
			) {
				await exec.transaction(async (tx) => {
					await lockTagNames(tx, false);
					await assertRefreshAttempt(tx, attempt);
					for (const candidate of candidates.slice(
						offset,
						offset + LEGACY_MIGRATION_BATCH_SIZE,
					)) {
						await mergeTag(tx, candidate, candidate.target);
					}
				});
			}
		},

		async replace(data, version, attempt) {
			return db().transaction(async (tx) => {
				let count = 0;
				switch (data.source) {
					case "tags":
						await tx.delete(tags);
						for (const rows of data.rows) {
							await tx.insert(tags).values(rows);
							count += rows.length;
						}
						break;
					case "wiki":
						await tx.delete(wiki);
						for await (const rows of data.rows) {
							await tx
								.insert(wiki)
								.values(rows)
								.onConflictDoUpdate({
									target: wiki.name,
									set: {
										body: sql`excluded.body`,
										otherNames: sql`excluded.other_names`,
										updatedAt: sql`excluded.updated_at`,
									},
									setWhere: sql`excluded.updated_at > ${wiki.updatedAt}`,
								});
						}
						count = (await tx.select({ count: countRows() }).from(wiki))[0]
							.count;
						break;
					case "attributes":
						await tx.delete(attributes);
						for await (const rows of data.rows) {
							await tx.insert(attributes).values(rows);
							count += rows.length;
						}
						break;
				}
				if (!count) throw new Error("Empty tag dictionary snapshot");
				await assertRefreshAttempt(tx, attempt);
				const snapshot = { version, count, installedAt: new Date() };
				await tx
					.insert(snapshots)
					.values({ source: data.source, ...snapshot })
					.onConflictDoUpdate({ target: snapshots.source, set: snapshot });
				return count;
			});
		},
	};
}
