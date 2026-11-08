import type {
	MediaRelatedReader,
	RelatedMediaSignals,
} from "@solid-imager/core/media";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
	mediaAuthors,
	mediaCharacters,
	mediaIps,
	medias,
	mediaTags,
	relatedTagFrequencies,
} from "../schema";
import type { DrizzleExecutor } from "../types";

/** Match direct relation IDs without multiplying rows for multi-character images. */
export function readRelatedMedia(
	db: DrizzleExecutor,
	mediaId: string,
	relation: Parameters<MediaRelatedReader["findRelatedByRelation"]>[1],
	limit: number,
	seed?: string,
) {
	const matchingMediaIds =
		relation === "character"
			? db
					.select({ id: mediaCharacters.mediaId })
					.from(mediaCharacters)
					.where(
						inArray(
							mediaCharacters.characterId,
							db
								.select({ id: mediaCharacters.characterId })
								.from(mediaCharacters)
								.where(eq(mediaCharacters.mediaId, mediaId)),
						),
					)
			: db
					.select({ id: mediaIps.mediaId })
					.from(mediaIps)
					.where(
						inArray(
							mediaIps.ipId,
							db
								.select({ id: mediaIps.ipId })
								.from(mediaIps)
								.where(eq(mediaIps.mediaId, mediaId)),
						),
					);

	return db
		.select()
		.from(medias)
		.where(
			and(
				ne(medias.id, mediaId),
				eq(medias.status, "active"),
				eq(medias.mediaType, "image"),
				inArray(medias.id, matchingMediaIds),
			),
		)
		.orderBy(
			seed === undefined
				? desc(medias.createdAt)
				: sql`md5(${medias.id}::text || ${seed})`,
			medias.id,
		)
		.limit(limit);
}

/**
 * Confidence-aware weighted Jaccard over positive tags. IDF is measured against
 * active images only; the union includes unmatched tags so tag-heavy images do
 * not win merely by having more tags. Manual tags (NULL confidence) have weight 1.
 * The migration maintains document frequencies transactionally as tags or media change.
 */
export function readRelatedTagMatches(
	db: DrizzleExecutor,
	mediaId: string,
	limit: number,
	seed: string,
) {
	// Gather postings from several discriminating tags before fetching full tag sets.
	// Keep rare lists whole and bound the work for tags present on most images.
	// Preliminary overlap uses anchor weights so probes can use the reverse
	// index alone. The final score uses every positive tag and both confidences.
	const postingsPerSide = 8192;
	const shortlistLimit = Math.max(512, limit * 4);
	const probe = (forward: boolean) => sql`
		select mt.media_id from ${mediaTags} mt
		where mt.tag_id = p.tag_id and mt.tag_type = 'positive'
			and mt.media_id ${forward ? sql`>` : sql`<`} ${mediaId}
		order by mt.media_id ${forward ? sql`asc` : sql`desc`} limit ${postingsPerSide}
	`;
	return db.select({
		mediaId: sql<string>`ranked.media_id`,
		score: sql<number>`ranked.score`.mapWith(Number),
	}).from(sql`(
		with eligible as (
			select id from ${medias} where status = 'active' and media_type = 'image'
		), population as (
			select count(*)::double precision as images from eligible
		), anchor_tags as (
			select tag_id, least(1.0, greatest(0.0, coalesce(confidence, 1.0))) as confidence
			from ${mediaTags}
			where media_id = ${mediaId} and tag_type = 'positive'
				and coalesce(confidence, 1.0) > 0
		), weights as (
			select f.tag_id,
				ln(1.0 + (select images from population) / (1.0 + f.image_count)) as weight
			from ${relatedTagFrequencies} f
		), anchor_weights as (
			select a.*, coalesce(w.weight, ln(1.0 + (select images from population))) as weight
			from anchor_tags a left join weights w using (tag_id)
		), probe_tags as (
			select a.tag_id, a.confidence * a.weight as priority from anchor_weights a
			join ${relatedTagFrequencies} f using (tag_id)
			where f.image_count > (select count(*) from ${medias}
				where id = ${mediaId} and status = 'active' and media_type = 'image')
			order by priority desc, a.tag_id limit 24
		), overlap_candidates as (
			select postings.media_id, sum(p.priority) as overlap
			from probe_tags p cross join lateral (
				(${probe(true)}) union all (${probe(false)})
			) postings group by postings.media_id
		), matching_ids as (
			select c.media_id from overlap_candidates c join eligible m on m.id = c.media_id
			order by c.overlap desc, md5(c.media_id::text || ${seed}), c.media_id limit ${shortlistLimit}
		), candidate_tags as (
			select mt.media_id, mt.tag_id,
				least(1.0, greatest(0.0, coalesce(mt.confidence, 1.0))) as confidence
			from matching_ids c
			cross join lateral (
				select media_id, tag_id, confidence from ${mediaTags}
				where media_id = c.media_id and tag_type = 'positive'
					and coalesce(confidence, 1.0) > 0
				-- Keep the indexed lookup bounded by the shortlist.
				offset 0
			) mt
		), anchor_mass as (
			select coalesce(sum(confidence * weight), 0) as mass from anchor_weights
		), intersections as (
			select c.media_id, sum(c.confidence * w.weight) as mass,
				sum(case when a.tag_id is null then 0 else least(c.confidence, a.confidence) * w.weight end) as overlap
			from candidate_tags c
			join weights w on w.tag_id = c.tag_id
			left join anchor_tags a on a.tag_id = c.tag_id
			group by c.media_id
		), scores as (
			select media_id, least(1.0, overlap / nullif(mass + (select mass from anchor_mass) - overlap, 0)) as score
			from intersections
		)
		select media_id, score from scores where score > 0
		order by score desc, md5(media_id::text || ${seed}), media_id
		limit ${limit}
	) ranked`);
}

/** Load diversity signals in batches; never issue a query per recommendation. */
export async function readRelatedMediaSignals(
	db: DrizzleExecutor,
	mediaIds: string[],
): Promise<RelatedMediaSignals[]> {
	if (mediaIds.length === 0) return [];
	const signals = new Map<string, RelatedMediaSignals>(
		mediaIds.map((mediaId) => [
			mediaId,
			{ mediaId, authorIds: [], tagIds: [] },
		]),
	);
	const [authors, tags] = await Promise.all([
		db
			.select()
			.from(mediaAuthors)
			.where(inArray(mediaAuthors.mediaId, mediaIds))
			.orderBy(mediaAuthors.authorId),
		db
			.select()
			.from(mediaTags)
			.where(
				and(
					inArray(mediaTags.mediaId, mediaIds),
					eq(mediaTags.tagType, "positive"),
					sql`coalesce(${mediaTags.confidence}, 1.0) > 0`,
				),
			)
			.orderBy(mediaTags.tagId),
	]);
	for (const row of authors)
		signals.get(row.mediaId)?.authorIds.push(row.authorId);
	for (const row of tags) signals.get(row.mediaId)?.tagIds.push(row.tagId);
	return [...signals.values()];
}
