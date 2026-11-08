import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { MediaRepository } from "~/infrastructure/db/repositories";
import {
	characterIps,
	authors,
	characters,
	ips,
	mediaCharacters,
	mediaAuthors,
	mediaIps,
	mediaTags,
	medias,
	mediaSources,
	tags,
	type NewMedia,
} from "~/infrastructure/db/schema";

describe("Related media relation queries", () => {
	const sourceIds = [randomUUID(), randomUUID()];
	const characterIds = [randomUUID(), randomUUID(), randomUUID()];
	const ipIds = [randomUUID(), randomUUID(), randomUUID()];
	const anchorId = randomUUID();
	// Fixed candidate IDs keep seeded sampling assertions independent of test randomness.
	const bothRelationsId = "a1111111-1111-4111-8111-111111111111";
	const secondRelationId = "a2222222-2222-4222-8222-222222222222";
	const otherSourceId = "a3333333-3333-4333-8333-333333333333";
	const unrelatedId = randomUUID();
	const archivedId = randomUUID();
	const deletedId = randomUUID();
	const videoId = randomUUID();
	const emptyId = randomUUID();
	const characterOnlyId = randomUUID();

	beforeAll(async () => {
		await db.insert(mediaSources).values(
			sourceIds.map((id) => ({
				id,
				name: `Related media ${id}`,
				type: "local" as const,
				connectionInfo: { path: "/related-media-test" },
			})),
		);
		await db
			.insert(characters)
			.values(characterIds.map((id) => ({ id, name: `Character ${id}` })));
		await db.insert(ips).values(ipIds.map((id) => ({ id, name: `IP ${id}` })));
		const fixture: Array<{
			id: string;
			day: number;
			status?: NewMedia["status"];
			mediaType?: NewMedia["mediaType"];
			mediaSourceId?: string;
		}> = [
			{ id: anchorId, day: 1 },
			{ id: bothRelationsId, day: 4 },
			{ id: secondRelationId, day: 3 },
			{ id: otherSourceId, day: 2, mediaSourceId: sourceIds[1] },
			{ id: unrelatedId, day: 5 },
			{ id: archivedId, day: 6, status: "archived" },
			{ id: deletedId, day: 7, status: "deleted" },
			{ id: videoId, day: 8, mediaType: "video" },
			{ id: emptyId, day: 9 },
			{ id: characterOnlyId, day: 1 },
		];
		await db.insert(medias).values(
			fixture.map(({ id, day, ...overrides }) => ({
				id,
				filePath: `${id}.png`,
				fileName: `${id}.png`,
				mediaSourceId: sourceIds[0],
				mediaType: "image" as const,
				width: 32,
				height: 24,
				createdAt: new Date(Date.UTC(2026, 0, day)),
				...overrides,
			})),
		);
		const relationPairs = [
			{ mediaId: anchorId, indexes: [0, 1] },
			{ mediaId: bothRelationsId, indexes: [0, 1] },
			{ mediaId: secondRelationId, indexes: [1] },
			{ mediaId: otherSourceId, indexes: [0] },
			{ mediaId: unrelatedId, indexes: [2] },
			{ mediaId: archivedId, indexes: [0] },
			{ mediaId: deletedId, indexes: [0] },
			{ mediaId: videoId, indexes: [0] },
		];
		await db.insert(mediaCharacters).values([
			...relationPairs.flatMap(({ mediaId, indexes }) =>
				indexes.map((index) => ({
					mediaId,
					characterId: characterIds[index],
				})),
			),
			{ mediaId: characterOnlyId, characterId: characterIds[2] },
		]);
		await db
			.insert(mediaIps)
			.values(
				relationPairs.flatMap(({ mediaId, indexes }) =>
					indexes.map((index) => ({ mediaId, ipId: ipIds[index] })),
				),
			);
		await db.insert(characterIps).values({
			characterId: characterIds[2],
			ipId: ipIds[0],
		});
	});

	afterAll(async () => {
		await db.delete(mediaSources).where(inArray(mediaSources.id, sourceIds));
		await db.delete(characters).where(inArray(characters.id, characterIds));
		await db.delete(ips).where(inArray(ips.id, ipIds));
	});

	it.each(["character", "ip"] as const)(
		"matches any shared %s ID across sources and excludes itself, inactive and non-image media",
		async (relation) => {
			const results = await MediaRepository.findRelatedByRelation(
				anchorId,
				relation,
				12,
			);
			expect(results.map((media) => media.id)).toEqual([
				bothRelationsId,
				secondRelationId,
				otherSourceId,
			]);
			expect(results[2].mediaSourceId).toBe(sourceIds[1]);
			expect(results[0].createdAt).toBeInstanceOf(Date);
		},
	);

	it.each(["character", "ip"] as const)(
		"applies the %s limit after filtering and deduplication",
		async (relation) => {
			const results = await MediaRepository.findRelatedByRelation(
				anchorId,
				relation,
				2,
			);
			expect(results.map((media) => media.id)).toEqual([
				bothRelationsId,
				secondRelationId,
			]);
		},
	);

	it.each(["character", "ip"] as const)(
		"does not recommend unrelated images when the anchor has no %s relations",
		async (relation) => {
			await expect(
				MediaRepository.findRelatedByRelation(emptyId, relation, 12),
			).resolves.toEqual([]);
		},
	);

	it("uses direct IP associations rather than inferring IPs from characters", async () => {
		await expect(
			MediaRepository.findRelatedByRelation(characterOnlyId, "ip", 12),
		).resolves.toEqual([]);
	});

	it("samples the whole relation set with a repeatable seed, including older images", async () => {
		const results = await Promise.all(
			Array.from({ length: 24 }, (_, index) =>
				MediaRepository.findRelatedByRelation(
					anchorId,
					"character",
					1,
					`sample-${index}`,
				),
			),
		);
		expect(
			new Set(results.flatMap((items) => items.map((item) => item.id))),
		).toEqual(new Set([bothRelationsId, secondRelationId, otherSourceId]));
		await expect(
			MediaRepository.findRelatedByRelation(
				anchorId,
				"character",
				1,
				"sample-0",
			),
		).resolves.toEqual(results[0]);
	});
});

describe("Related media tag queries", () => {
	const sourceId = randomUUID();
	const otherSourceId = randomUUID();
	const tagIds = Array.from({ length: 6 }, () => randomUUID());
	const authorId = randomUUID();
	const characterId = randomUUID();
	const ids = {
		anchor: randomUUID(),
		rare: randomUUID(),
		common: randomUUID(),
		exact: randomUUID(),
		extra: randomUUID(),
		lowConfidence: randomUUID(),
		negative: randomUUID(),
		zeroConfidence: randomUUID(),
		archived: randomUUID(),
		video: randomUUID(),
		empty: randomUUID(),
	};
	const fillerIds = Array.from(
		{ length: 12 },
		(_, index) =>
			`b0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
	);

	beforeAll(async () => {
		await db.insert(mediaSources).values(
			[sourceId, otherSourceId].map((id) => ({
				id,
				name: `Tag recommendations ${id}`,
				type: "local" as const,
				connectionInfo: { path: "/related-tag-test" },
			})),
		);
		await db
			.insert(tags)
			.values(tagIds.map((id) => ({ id, name: `Related tag ${id}` })));
		await db
			.insert(authors)
			.values({ id: authorId, name: `Related author ${authorId}` });
		await db
			.insert(characters)
			.values({ id: characterId, name: `Related character ${characterId}` });
		await db.insert(medias).values(
			[...Object.values(ids), ...fillerIds].map((id) => ({
				id,
				mediaSourceId: id === ids.rare ? otherSourceId : sourceId,
				filePath: `${id}.png`,
				fileName: `${id}.png`,
				width: 32,
				height: 24,
				mediaType: id === ids.video ? ("video" as const) : ("image" as const),
				status:
					id === ids.archived ? ("archived" as const) : ("active" as const),
			})),
		);
		const positives: Array<{
			mediaId: string;
			indexes: number[];
			confidence?: number;
		}> = [
			{ mediaId: ids.anchor, indexes: [0, 1] },
			{ mediaId: ids.rare, indexes: [1] },
			{ mediaId: ids.common, indexes: [0] },
			{ mediaId: ids.exact, indexes: [0, 1] },
			{ mediaId: ids.extra, indexes: [0, 1, 2, 3, 4] },
			{ mediaId: ids.lowConfidence, indexes: [0, 1], confidence: 0.1 },
			{ mediaId: ids.zeroConfidence, indexes: [0, 1, 2], confidence: 0 },
			{ mediaId: ids.archived, indexes: [0, 1, 2, 3, 4] },
			{ mediaId: ids.video, indexes: [0, 1, 2, 5] },
			...fillerIds.map((mediaId) => ({ mediaId, indexes: [0] })),
		];
		await db.insert(mediaTags).values([
			...positives.flatMap(({ mediaId, indexes, confidence }) =>
				indexes.map((index) => ({
					mediaId,
					tagId: tagIds[index],
					tagType: "positive" as const,
					confidence: confidence ?? null,
				})),
			),
			{ mediaId: ids.negative, tagId: tagIds[1], tagType: "negative" as const },
			{ mediaId: ids.negative, tagId: tagIds[2], tagType: "negative" as const },
			{ mediaId: ids.exact, tagId: tagIds[1], tagType: "negative" as const },
		]);
		await db.insert(mediaAuthors).values({ mediaId: ids.exact, authorId });
		await db
			.insert(mediaCharacters)
			.values({ mediaId: ids.exact, characterId });
	});

	afterAll(async () => {
		await db
			.delete(mediaSources)
			.where(inArray(mediaSources.id, [sourceId, otherSourceId]));
		await db.delete(tags).where(inArray(tags.id, tagIds));
		await db.delete(authors).where(inArray(authors.id, [authorId]));
		await db.delete(characters).where(inArray(characters.id, [characterId]));
	});

	it("weights rare positive tags, normalizes extra tags, and respects confidence", async () => {
		const results = await MediaRepository.findRelatedByTags(
			ids.anchor,
			100,
			"tags",
		);
		const score = (id: string) =>
			results.find((item) => item.media.id === id)?.score ?? 0;
		expect(results[0].media.id).toBe(ids.exact);
		expect(score(ids.exact)).toBeCloseTo(1);
		expect(score(ids.rare)).toBeGreaterThan(score(ids.common));
		expect(score(ids.extra)).toBeLessThan(score(ids.exact));
		expect(score(ids.lowConfidence)).toBeCloseTo(0.1);
		expect(
			results.find((item) => item.media.id === ids.rare)?.media.mediaSourceId,
		).toBe(otherSourceId);
		expect(results.every((item) => item.score > 0 && item.score <= 1)).toBe(
			true,
		);
		for (const excluded of [
			ids.anchor,
			ids.negative,
			ids.zeroConfidence,
			ids.archived,
			ids.video,
		]) {
			expect(results.some((item) => item.media.id === excluded)).toBe(false);
		}
	});

	it("is deterministic for one seed and samples tied candidates before limiting", async () => {
		const result = await MediaRepository.findRelatedByTags(
			ids.common,
			2,
			"first",
		);
		await expect(
			MediaRepository.findRelatedByTags(ids.common, 2, "first"),
		).resolves.toEqual(result);
		expect(result).toHaveLength(2);
		const alternatives = await Promise.all(
			["second", "third", "fourth"].map((seed) =>
				MediaRepository.findRelatedByTags(ids.common, 2, seed),
			),
		);
		expect(
			new Set(
				[result, ...alternatives].flatMap((items) =>
					items.map((item) => item.media.id),
				),
			).size,
		).toBeGreaterThan(2);
	});

	it("uses active positive document frequencies for both reused anchor weights and candidate-only weights", async () => {
		const results = await MediaRepository.findRelatedByTags(
			ids.anchor,
			100,
			"idf",
		);
		// The fixture has 21 active images. The common tag occurs on 17 of them,
		// the rare tag on 5, and each candidate-only tag on exactly one image.
		// Archived/video/negative/zero-confidence associations must not raise df.
		const commonWeight = Math.log(1 + 21 / (1 + 17));
		const rareWeight = Math.log(1 + 21 / (1 + 5));
		const candidateOnlyWeight = Math.log(1 + 21 / (1 + 1));
		const anchorMass = commonWeight + rareWeight;
		const score = (id: string) =>
			results.find((item) => item.media.id === id)?.score;
		expect(score(ids.rare)).toBeCloseTo(rareWeight / anchorMass, 10);
		expect(score(ids.common)).toBeCloseTo(commonWeight / anchorMass, 10);
		expect(score(ids.extra)).toBeCloseTo(
			anchorMass / (anchorMass + 3 * candidateOnlyWeight),
			10,
		);
	});

	it("returns no tag candidates without positive anchor tags", async () => {
		await expect(
			MediaRepository.findRelatedByTags(ids.empty, 12, "empty"),
		).resolves.toEqual([]);
		await expect(
			MediaRepository.findRelatedByTags(ids.negative, 12, "negative"),
		).resolves.toEqual([]);
	});

	it("includes anchor-only tags in the union even when the anchor is not an image", async () => {
		const results = await MediaRepository.findRelatedByTags(
			ids.video,
			100,
			"video",
		);
		const exact = results.find((item) => item.media.id === ids.exact);
		expect(exact).toBeDefined();
		expect(exact?.score).toBeLessThan(1);
		expect(exact?.score).toBeGreaterThan(0);
	});

	it("loads distinct authors and positive tag signals in input order", async () => {
		await expect(
			MediaRepository.getRelatedMediaSignals([
				ids.exact,
				ids.empty,
				ids.negative,
				ids.zeroConfidence,
			]),
		).resolves.toEqual([
			{
				mediaId: ids.exact,
				authorIds: [authorId],
				tagIds: [tagIds[0], tagIds[1]].sort(),
			},
			{ mediaId: ids.empty, authorIds: [], tagIds: [] },
			{ mediaId: ids.negative, authorIds: [], tagIds: [] },
			{
				mediaId: ids.zeroConfidence,
				authorIds: [],
				tagIds: [],
			},
		]);
		await expect(MediaRepository.getRelatedMediaSignals([])).resolves.toEqual(
			[],
		);
	});

	it("keeps rare-tag matches ahead of generic matches when the shortlist limit is reached", async () => {
		const genericIds = Array.from({ length: 600 }, () => randomUUID());
		await db.insert(medias).values(
			genericIds.map((id) => ({
				id,
				mediaSourceId: sourceId,
				filePath: `${id}.png`,
				fileName: `${id}.png`,
				width: 32,
				height: 24,
				mediaType: "image" as const,
			})),
		);
		await db.insert(mediaTags).values(
			genericIds.map((mediaId) => ({
				mediaId,
				tagId: tagIds[0],
				tagType: "positive" as const,
			})),
		);
		const results = await MediaRepository.findRelatedByTags(
			ids.anchor,
			2,
			"large-pool",
		);
		expect(results.map((item) => item.media.id)).toEqual([ids.exact, ids.rare]);
	});
	it("does not spend the tag probe budget on tags belonging only to the anchor", async () => {
		const uniqueTags = Array.from({ length: 10 }, () => randomUUID());
		try {
			await db.insert(tags).values(uniqueTags.map((id) => ({ id, name: id })));
			await db
				.insert(mediaTags)
				.values(uniqueTags.map((tagId) => ({ tagId, mediaId: ids.anchor })));
			const matches = await MediaRepository.findRelatedByTags(
				ids.anchor,
				12,
				"unique",
			);
			expect(matches.some(({ media }) => media.id === ids.exact)).toBe(true);
			expect(matches.some(({ media }) => media.id === ids.rare)).toBe(true);
		} finally {
			await db.delete(tags).where(inArray(tags.id, uniqueTags));
		}
	});
});
