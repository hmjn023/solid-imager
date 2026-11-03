import {
	STATISTICS_PAGE_SIZE,
	statisticsResponseSchema,
	type LibraryStatistics,
	type StatisticsRequest,
} from "@solid-imager/core/domain/media/statistics";
import { sql } from "drizzle-orm";
import {
	characterIps,
	characters,
	ips,
	mediaCharacters,
	mediaIps,
	medias,
} from "../schema";
import type { DrizzleExecutor } from "../types";

/** One snapshot keeps the totals, rankings, and drill-down consistent during imports. */
export async function readLibraryStatistics(
	db: DrizzleExecutor,
	input: StatisticsRequest,
): Promise<LibraryStatistics> {
	const recent = input.period !== "all";
	const unit = recent ? "day" : "month";
	const today = sql`(now() at time zone ${input.timeZone})::date`;
	const localDate = sql`(indexed_at at time zone 'UTC' at time zone ${input.timeZone})::date`;
	const periodStart = recent
		? sql`${today} - 29`
		: sql`(select min(bucket) from library)`;
	const scope = input.bucket
		? sql`where bucket = ${input.bucket}::date`
		: sql``;
	const showMedia = Boolean(input.bucket || input.ipId || input.characterId);
	const [row] = await db.select({
		trend: sql`stats.trend`,
		ips: sql`stats.ips`,
		characters: sql`stats.characters`,
		media: sql`stats.media`,
		hasMore: sql<boolean>`stats.has_more`,
	}).from(sql`(
		with library as (
			select id, source_id, file_name, indexed_at, date_trunc(${unit}, ${localDate}::timestamp)::date as bucket
			from ${medias}
			where status <> 'deleted'
				and ${localDate} <= ${today}
				${recent ? sql`and ${localDate} >= ${today} - 29` : sql``}
		), counts as (
			select bucket, count(*) as count from library group by bucket
		), trend as (
			select day::date as bucket, coalesce(counts.count, 0) as count
			from generate_series((${periodStart})::timestamp, ${today}::timestamp, ${recent ? "1 day" : "1 month"}::interval) day
			left join counts on counts.bucket = day::date
		), scoped as (
			select * from library ${scope}
		), appearances as (
			select mc.media_id, mc.character_id from ${mediaCharacters} mc join scoped on scoped.id = mc.media_id
		), works as (
			select mi.media_id, mi.ip_id from ${mediaIps} mi join scoped on scoped.id = mi.media_id
			union
			select a.media_id, ci.ip_id from appearances a join ${characterIps} ci using (character_id)
		), ranked_ips as (
			select i.id, i.name, count(*) as count from works join ${ips} i on i.id = works.ip_id
			group by i.id, i.name order by count desc, i.name, i.id limit 10
		), scoped_characters as (
			select a.* from appearances a
			${input.ipId ? sql`join ${characterIps} ci on ci.character_id = a.character_id and ci.ip_id = ${input.ipId}` : sql``}
		), ranked_characters as (
			select c.id, c.name, count(*) as count from scoped_characters a join ${characters} c on c.id = a.character_id
			group by c.id, c.name order by count desc, c.name, c.id limit 10
		), matches as (
			select s.id, s.source_id as "mediaSourceId", s.file_name as "fileName", s.indexed_at
			from scoped s where ${showMedia}
			${input.ipId ? sql`and exists (select 1 from works w where w.media_id = s.id and w.ip_id = ${input.ipId})` : sql``}
			${input.characterId ? sql`and exists (select 1 from scoped_characters a where a.media_id = s.id and a.character_id = ${input.characterId})` : sql``}
			order by s.indexed_at desc, s.id limit ${STATISTICS_PAGE_SIZE + 1} offset ${(input.page ?? 0) * STATISTICS_PAGE_SIZE}
		)
		select
			coalesce((select jsonb_agg(to_jsonb(t) order by bucket) from trend t), '[]') as trend,
			coalesce((select jsonb_agg(to_jsonb(i) order by count desc, name, id) from ranked_ips i), '[]') as ips,
			coalesce((select jsonb_agg(to_jsonb(c) order by count desc, name, id) from ranked_characters c), '[]') as characters,
			coalesce((select jsonb_agg(to_jsonb(m) - 'indexed_at' order by indexed_at desc, id)
				from (select * from matches order by indexed_at desc, id limit ${STATISTICS_PAGE_SIZE}) m), '[]') as media,
			(select count(*) > ${STATISTICS_PAGE_SIZE} from matches) as has_more
	) stats`);
	return statisticsResponseSchema.parse(row);
}
