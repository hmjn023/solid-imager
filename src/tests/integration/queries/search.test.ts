import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import {
  globalSearchMedia,
  searchMedia,
  searchMediaInDirectory,
} from "~/infrastructure/db/queries/search";
import {
  mediaSources,
  medias,
  mediaTags,
  type NewMedia,
  type NewTag,
  tags,
} from "~/infrastructure/db/schema";

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
    const tagsToInsert: NewTag[] = [{ name: "fruit" }, { name: "dessert" }];
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
    const results = await searchMedia(mediaSourceId1, { query: "red" });
    expect(results.length).toBe(1);
    expect(results[0].fileName).toBe("apple.jpg");
  });

  it("should search media by tag within a source", async () => {
    const results = await searchMedia(mediaSourceId1, { tags: ["fruit"] });
    expect(results.length).toBe(2);
  });

  it("should search media in a specific directory", async () => {
    const results = await searchMediaInDirectory(mediaSourceId1, "dir1", {
      query: "fruit",
    });
    expect(results.length).toBe(2);
  });

  it("should perform a global search by query", async () => {
    const results = await globalSearchMedia({ query: "apple" });
    expect(results.length).toBe(2);
  });

  it("should perform a global search by tag", async () => {
    const results = await globalSearchMedia({ tags: ["dessert"] });
    expect(results.length).toBe(1);
    expect(results[0].fileName).toBe("apple_pie.jpg");
  });
});
