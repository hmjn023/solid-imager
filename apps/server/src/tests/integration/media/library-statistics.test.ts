import { describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import {
	characterIps,
	characters,
	ips,
	mediaCharacters,
	mediaIps,
	mediaDetails,
	mediaGenerationInfo,
	medias,
	mediaSources,
} from "~/infrastructure/db/schema";
import {
	getCharacterMediaCounts,
	getIpMediaCounts,
} from "~/infrastructure/api/routers/entity-media-counts";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";

describe("library statistics", () => {
	it("uses local registration days, preserves them on rescan, and agrees with Manager on direct associations", async () => {
		const timeZone = "Asia/Tokyo";
		const today = new Intl.DateTimeFormat("sv-SE", { timeZone }).format(
			new Date(),
		);
		const midnight = new Date(today + "T00:00:00+09:00").getTime();
		const dayMs = 86_400_000;
		const firstDay = midnight - 29 * dayMs;
		const [source] = await db
			.insert(mediaSources)
			.values({ name: "Statistics", type: "local", connectionInfo: {} })
			.returning();
		const [work] = await db
			.insert(ips)
			.values({ name: "Stats IP" })
			.returning();
		const [one, two] = await db
			.insert(characters)
			.values([{ name: "Stats A" }, { name: "Stats B" }])
			.returning();
		await db
			.insert(characterIps)
			.values([one, two].map((c) => ({ characterId: c.id, ipId: work.id })));
		const base = {
			mediaSourceId: source.id,
			mediaType: "image",
			fileSize: 20,
			width: 1,
			height: 1,
			description: null,
		} as const;
		const lastYear = new Date(today + "T00:00:00+09:00");
		lastYear.setUTCFullYear(lastYear.getUTCFullYear() - 1);
		const [old] = await db
			.insert(medias)
			.values({ ...base, fileName: "0", filePath: "0", indexedAt: lastYear })
			.returning();
		const quiet = await MediaRepository.getStatistics({
			period: "recent",
			timeZone,
		});
		expect(quiet.trend).toHaveLength(30);
		expect(
			quiet.trend.every((day) => day.count === 0 && day.cumulative === 1),
		).toBe(true);
		const entries = await db
			.insert(medias)
			.values([
				{
					...base,
					fileName: "1",
					filePath: "1",
					indexedAt: new Date(firstDay),
					mediaType: "video",
				},
				{
					...base,
					fileName: "2",
					filePath: "2",
					indexedAt: new Date(midnight + 1),
				},
				{
					...base,
					fileName: "3",
					filePath: "3",
					indexedAt: new Date(midnight + 1),
					status: "deleted",
				},
			])
			.returning();
		const items = [old, ...entries];
		await db
			.insert(mediaCharacters)
			.values([
				...items.map((m) => ({ mediaId: m.id, characterId: one.id })),
				{ mediaId: items[2].id, characterId: two.id },
			]);
		await db.insert(mediaGenerationInfo).values([
			{ mediaId: items[0].id, modelName: "Library A" },
			{ mediaId: items[1].id, modelName: "  Library A " },
			{ mediaId: items[2].id, modelName: "Library B" },
			{ mediaId: items[3].id, modelName: "Deleted model" },
		]);
		await db.insert(mediaDetails).values([
			{ mediaId: items[0].id, favorite: true },
			{ mediaId: items[2].id, favorite: true },
		]);
		await db.insert(mediaIps).values(
			[items[0], items[2], items[3]].map((item) => ({
				mediaId: item.id,
				ipId: work.id,
			})),
		);
		const rescanned = await MediaRepository.upsert({
			...base,
			fileName: "0",
			filePath: "0",
		});
		expect(rescanned.indexedAt.getTime()).toBe(lastYear.getTime());
		const recent = await MediaRepository.getStatistics({
			period: "recent",
			timeZone,
		});
		expect(recent.trend).toHaveLength(30);
		expect(recent.trend[0]).toMatchObject({ count: 1, cumulative: 2 });
		expect(recent.trend[1]).toMatchObject({ count: 0, cumulative: 2 });
		expect(recent.trend.at(-1)).toEqual({
			bucket: today,
			count: 1,
			cumulative: 3,
		});
		expect(recent.trend.reduce((sum, b) => sum + b.count, 0)).toBe(2);
		expect(recent.mediaTypes).toEqual([
			{ type: "image", count: 1 },
			{ type: "video", count: 1 },
		]);
		expect(recent.models).toEqual([
			{ name: "Library B", count: 1, favorites: 1 },
			{ name: "Library A", count: 1, favorites: 0 },
		]);
		expect(recent.ips).toEqual([{ id: work.id, name: work.name, count: 1 }]);
		expect(recent.characters.map((c) => c.count)).toEqual([2, 1]);
		const all = await MediaRepository.getStatistics({
			period: "all",
			timeZone,
		});
		expect(all.trend.reduce((sum, b) => sum + b.count, 0)).toBe(3);
		expect(all.trend[0].bucket.slice(0, 4)).toBe(
			String(Number(today.slice(0, 4)) - 1),
		);
		expect(all.trend.at(-1)?.cumulative).toBe(3);
		const managerIps = await getIpMediaCounts([work.id]);
		const managerCharacters = await getCharacterMediaCounts([one.id, two.id]);
		expect(all.ips).toEqual([{ id: work.id, name: work.name, count: 2 }]);
		expect(all.ips[0].count).toBe(managerIps.get(work.id));
		expect(
			new Map(
				all.characters.map((character) => [character.id, character.count]),
			),
		).toEqual(managerCharacters);
		expect(all.models).toEqual([
			{ name: "Library A", count: 2, favorites: 1 },
			{ name: "Library B", count: 1, favorites: 1 },
		]);
		expect(all.mediaTypes).toEqual([
			{ type: "image", count: 2 },
			{ type: "video", count: 1 },
		]);
		expect(all.trend.every((b) => b.bucket.endsWith("-01"))).toBe(true);
		// Even an unaffiliated character appearing on a directly linked work must open the same media it counts.
		const [guest] = await db
			.insert(characters)
			.values({ name: "Guest" })
			.returning();
		await db
			.insert(mediaCharacters)
			.values({ mediaId: items[2].id, characterId: guest.id });
		const selected = await MediaRepository.getStatistics({
			period: "recent",
			timeZone,
			bucket: today,
			ipId: work.id,
			characterId: guest.id,
		});
		expect(selected.ips[0].count).toBe(1);
		expect(selected.characters.map((c) => c.count)).toEqual([1, 1, 1]);
		expect(selected.media.map((m) => m.id)).toEqual([items[2].id]);
		expect(selected.mediaTypes).toEqual([{ type: "image", count: 1 }]);
		expect(selected.models).toEqual([
			{ name: "Library B", count: 1, favorites: 1 },
		]);
		expect(selected.hasMore).toBe(false);
	});
});
