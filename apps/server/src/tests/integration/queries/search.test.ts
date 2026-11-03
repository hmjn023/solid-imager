import type { MediaSearchRequest } from "@solid-imager/core/media";
import {
	defaultState,
	getSearchConditionFromState,
	type SearchState,
} from "@solid-imager/core/search";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import {
	mediaSources,
	medias,
	mediaTags,
	type NewMedia,
	tags,
} from "~/infrastructure/db/schema";
import { MediaRepository } from "~/infrastructure/db/repositories";

function searchParams(filters: Partial<SearchState>): MediaSearchRequest {
	return {
		condition: getSearchConditionFromState({ ...defaultState, ...filters }),
		offset: 0,
		order: "desc",
	};
}

describe("search queries Integration", () => {
	const mediaSourceId1 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14";
	const mediaSourceId2 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15";

	beforeAll(async () => {
		// Clean up
		await db.delete(mediaTags);
		await db.delete(tags);
		await db.delete(medias);
		await db.delete(mediaSources);

		// Seed sources
		await db.insert(mediaSources).values([
			{
				id: mediaSourceId1,
				name: "Search Source 1",
				type: "local",
				connectionInfo: { path: "/" },
			},
			{
				id: mediaSourceId2,
				name: "Search Source 2",
				type: "local",
				connectionInfo: { path: "/" },
			},
		]);

		// Seed media
		const mediaToInsert: NewMedia[] = [
			{
				mediaSourceId: mediaSourceId1,
				filePath: "dir1/apple.jpg",
				fileName: "apple.jpg",
				description: "A red fruit",
				mediaType: "image",
				width: 1,
				height: 1,
			},
			{
				mediaSourceId: mediaSourceId1,
				filePath: "dir1/banana.jpg",
				fileName: "banana.jpg",
				description: "A yellow fruit",
				mediaType: "image",
				width: 1,
				height: 1,
			},
			{
				mediaSourceId: mediaSourceId2,
				filePath: "dir2/apple_pie.jpg",
				fileName: "apple_pie.jpg",
				description: "A tasty dessert",
				mediaType: "image",
				width: 1,
				height: 1,
			},
		];
		const insertedMedia = await db
			.insert(medias)
			.values(mediaToInsert)
			.returning();

		// Seed tags
		const tagsToInsert = [{ name: "fruit" }, { name: "dessert" }];
		const insertedTags = await db.insert(tags).values(tagsToInsert).returning();

		// Associate tags
		await db.insert(mediaTags).values([
			{
				mediaId: insertedMedia[0].id,
				tagId: insertedTags[0].id,
				tagType: "positive",
				source: "manual",
			}, // apple -> fruit
			{
				mediaId: insertedMedia[1].id,
				tagId: insertedTags[0].id,
				tagType: "positive",
				source: "manual",
			}, // banana -> fruit
			{
				mediaId: insertedMedia[2].id,
				tagId: insertedTags[1].id,
				tagType: "positive",
				source: "manual",
			}, // apple_pie -> dessert
		]);
	});

	afterAll(async () => {
		await db.delete(mediaTags);
		await db.delete(tags);
		await db.delete(medias);
		await db.delete(mediaSources);
	});

	it("should search media by query within a source", async () => {
		const { media: results } = await MediaRepository.search(
			mediaSourceId1,
			searchParams({
				searchQuery: "red",
			}),
		);
		expect(results.length).toBe(1);
		expect(results[0].fileName).toBe("apple.jpg");
	});

	it("should search media by tag within a source", async () => {
		const { media: results } = await MediaRepository.search(
			mediaSourceId1,
			searchParams({
				selectedTags: ["fruit"],
			}),
		);
		expect(results.length).toBe(2);
	});

	it("should search media in a specific directory", async () => {
		const results = await MediaRepository.searchInDirectory(
			mediaSourceId1,
			"dir1",
			{
				query: "fruit",
			},
		);
		expect(results.length).toBe(2);
	});

	it("finds tagged media added in the current transaction", async () => {
		await db.transaction(async (tx) => {
			const [image] = await tx
				.insert(medias)
				.values({
					mediaSourceId: mediaSourceId1,
					filePath: "dir1/cherry.jpg",
					fileName: "cherry.jpg",
					mediaType: "image",
					width: 1,
					height: 1,
					fileSize: 1,
				})
				.returning();
			const [tag] = await tx
				.insert(tags)
				.values({ name: "cherry" })
				.returning();
			await tx
				.insert(mediaTags)
				.values({ mediaId: image.id, tagId: tag.id, tagType: "positive" });

			const results = await MediaRepository.searchInDirectory(
				mediaSourceId1,
				"dir1",
				{ tags: ["cherry"] },
				tx,
			);
			expect(results.map((media) => media.id)).toEqual([image.id]);
		});
	});

	it("should perform a global search by query", async () => {
		const { media: results } = await MediaRepository.globalSearch(
			searchParams({
				searchQuery: "apple",
			}),
		);
		expect(results.length).toBe(2);
	});

	it("should perform a global search by tag", async () => {
		const { media: results } = await MediaRepository.globalSearch(
			searchParams({
				selectedTags: ["dessert"],
			}),
		);
		expect(results.length).toBe(1);
		expect(results[0].fileName).toBe("apple_pie.jpg");
	});
});
