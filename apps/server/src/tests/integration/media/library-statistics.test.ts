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
import { MediaRepository } from "~/infrastructure/repositories/media-repository";

describe("library statistics", () => {
	it("uses local registration days, preserves them on rescan, and counts each media once per IP", async () => {
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
		const indexed = [firstDay - 1, firstDay, midnight + 1, midnight + 1];
		const items = await db
			.insert(medias)
			.values(
				indexed.map((ms, i) => ({
					...base,
					fileName: String(i),
					filePath: String(i),
					indexedAt: new Date(ms),
					mediaType: i === 1 ? ("video" as const) : ("image" as const),
					status: i === 3 ? ("deleted" as const) : ("active" as const),
				})),
			)
			.returning();
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
		await db.insert(mediaIps).values({ mediaId: items[2].id, ipId: work.id });
		const rescanned = await MediaRepository.upsert({
			...base,
			fileName: "0",
			filePath: "0",
		});
		expect(rescanned.indexedAt.getTime()).toBe(firstDay - 1);
		const recent = await MediaRepository.getStatistics({
			period: "recent",
			timeZone,
		});
		expect(recent.trend).toHaveLength(30);
		expect(recent.trend[0].count).toBe(1);
		expect(recent.trend.at(-1)).toEqual({ bucket: today, count: 1 });
		expect(recent.trend.reduce((sum, b) => sum + b.count, 0)).toBe(2);
		expect(recent.mediaTypes).toEqual([
			{ type: "image", count: 1 },
			{ type: "video", count: 1 },
		]);
		expect(recent.models).toEqual([
			{ name: "Library B", count: 1, favorites: 1 },
			{ name: "Library A", count: 1, favorites: 0 },
		]);
		expect(recent.ips).toEqual([{ id: work.id, name: work.name, count: 2 }]);
		expect(recent.characters.map((c) => c.count)).toEqual([2, 1]);
		const all = await MediaRepository.getStatistics({
			period: "all",
			timeZone,
		});
		expect(all.trend.reduce((sum, b) => sum + b.count, 0)).toBe(3);
		expect(all.ips[0].count).toBe(3);
		expect(all.models).toEqual([
			{ name: "Library A", count: 2, favorites: 1 },
			{ name: "Library B", count: 1, favorites: 1 },
		]);
		expect(all.mediaTypes).toEqual([
			{ type: "image", count: 2 },
			{ type: "video", count: 1 },
		]);
		expect(all.trend.every((b) => b.bucket.endsWith("-01"))).toBe(true);
		const selected = await MediaRepository.getStatistics({
			period: "recent",
			timeZone,
			bucket: today,
			ipId: work.id,
			characterId: two.id,
		});
		expect(selected.ips[0].count).toBe(1);
		expect(selected.characters.map((c) => c.count)).toEqual([1, 1]);
		expect(selected.media.map((m) => m.id)).toEqual([items[2].id]);
		expect(selected.mediaTypes).toEqual([{ type: "image", count: 1 }]);
		expect(selected.models).toEqual([
			{ name: "Library B", count: 1, favorites: 1 },
		]);
		expect(selected.hasMore).toBe(false);
	});
});
