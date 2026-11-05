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
 */
export function readRelatedTagMatches(
	db: DrizzleExecutor,
	mediaId: string,
	limit: number,
	seed: string,
) {
	// Rank shared tags first so ubiquitous anchor tags do not expand every image's
	// full tag set. Rarity participates before this bound, preserving rare matches.
	const shortlistLimit = Math.min(2048, Math.max(512, limit * 4));
	return db.select({
		mediaId: sql<string>`ranked.media_id`,
		score: sql<number>`ranked.score`.mapWith(Number),
	}).from(sql`(
		with eligible as (
			select id from ${medias} where status = 'active' and media_type = 'image'
		), anchor_tags as (
			select tag_id, least(1.0, greatest(0.0, coalesce(confidence, 1.0))) as confidence
			from ${mediaTags}
			where media_id = ${mediaId} and tag_type = 'positive'
				and coalesce(confidence, 1.0) > 0
		), anchor_weights as (
			select a.tag_id, a.confidence,
				ln(1.0 + (select count(*) from eligible)::double precision / (1.0 + count(e.id))) as weight
			from anchor_tags a
			join ${mediaTags} mt on mt.tag_id = a.tag_id
			left join eligible e on e.id = mt.media_id
			where mt.tag_type = 'positive' and coalesce(mt.confidence, 1.0) > 0
			group by a.tag_id, a.confidence
		), preliminary_scores as (
			select mt.media_id,
				sum(least(1.0, greatest(0.0, coalesce(mt.confidence, 1.0)), a.confidence) * a.weight) as overlap
			from ${mediaTags} mt
			join anchor_weights a on a.tag_id = mt.tag_id
			join eligible e on e.id = mt.media_id
			where mt.tag_type = 'positive' and coalesce(mt.confidence, 1.0) > 0
				and mt.media_id <> ${mediaId}
			group by mt.media_id
		), matching_ids as (
			select media_id from preliminary_scores
			order by overlap desc, md5(media_id::text || ${seed}), media_id
			limit ${shortlistLimit}
		), candidate_tags as (
			select mt.media_id, mt.tag_id,
				least(1.0, greatest(0.0, coalesce(mt.confidence, 1.0))) as confidence
			from ${mediaTags} mt join matching_ids c on c.media_id = mt.media_id
			where mt.tag_type = 'positive' and coalesce(mt.confidence, 1.0) > 0
		), relevant_tags as (
			select tag_id from anchor_tags union select tag_id from candidate_tags
		), frequencies as (
			select mt.tag_id, count(*)::double precision as frequency
			from ${mediaTags} mt
			join relevant_tags r on r.tag_id = mt.tag_id
			join eligible e on e.id = mt.media_id
			where mt.tag_type = 'positive' and coalesce(mt.confidence, 1.0) > 0
			group by mt.tag_id
		), weights as (
			select r.tag_id,
				ln(1.0 + (select count(*) from eligible)::double precision / (1.0 + coalesce(f.frequency, 0))) as weight
			from relevant_tags r left join frequencies f on f.tag_id = r.tag_id
		), anchor_mass as (
			select coalesce(sum(a.confidence * w.weight), 0) as mass
			from anchor_tags a join weights w on w.tag_id = a.tag_id
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
