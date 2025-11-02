import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { insertMediaTags } from "~/infrastructure/db/queries/tags";
import {
  mediaSources,
  medias,
  mediaTags,
  type NewMedia,
  tags,
} from "~/infrastructure/db/schema";

describe("tags and mediaTags queries Integration", () => {
  const testSourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13";
  let testMediaId: string;

  beforeEach(async () => {
    // Clean up
    await db.delete(mediaTags);
    await db.delete(tags);
    await db.delete(medias);
    await db.delete(mediaSources);

    // Seed media source
    await db.insert(mediaSources).values({
      id: testSourceId,
      name: "Tag Test Source",
      type: "local",
      connectionInfo: { path: "/tag/test" },
    });

    // Seed media
    const initialMedia: NewMedia = {
      sourceId: testSourceId,
      filePath: "/tag/test/initial.jpg",
      fileName: "initial.jpg",
      mediaType: "image",
      width: 100,
      height: 100,
    };
    const inserted = await db.insert(medias).values(initialMedia).returning();
    testMediaId = inserted[0].id;
  });

  afterEach(async () => {
    // Final cleanup
    await db.delete(mediaTags);
    await db.delete(tags);
    await db.delete(medias);
    await db.delete(mediaSources);
  });

  it("should insert new tags and associate them with media", async () => {
    const newTags = [
      { name: "tag1", type: "positive" as const },
      { name: "tag2", type: "positive" as const },
      { name: "new-tag", type: "positive" as const },
    ];
    const ExpectedTagCount = newTags.length;
    await db.insert(tags).values({ name: "tag1" }); // Pre-existing tag

    await insertMediaTags(testMediaId, newTags, "manual");

    // Verification
    const createdTags = await db
      .select()
      .from(tags)
      .where(sql`name IN ('tag1', 'tag2', 'new-tag')`);
    expect(createdTags.length).toBe(ExpectedTagCount);

    const associated = await db
      .select()
      .from(mediaTags)
      .where(eq(mediaTags.mediaId, testMediaId));
    expect(associated.length).toBe(ExpectedTagCount);
    expect(associated.every(t => t.tagType === "positive")).toBe(true);
  });

  it("should not create duplicate tags or associations", async () => {
    const tagsToInsert = [
      { name: "unique-tag1", type: "positive" as const },
      { name: "unique-tag2", type: "negative" as const },
    ];
    await insertMediaTags(testMediaId, tagsToInsert, "manual");

    await insertMediaTags(testMediaId, tagsToInsert, "manual");

    const associated = await db
      .select()
      .from(mediaTags)
      .where(eq(mediaTags.mediaId, testMediaId));
    const tagIds = associated.map((t) => t.tagId);
    const createdTags = await db
      .select()
      .from(tags)
      .where(sql`id IN ${tagIds}`);

    // Ensure no duplicates were created
    const tagNames = createdTags.map((t) => t.name);
    expect(new Set(tagNames).size).toBe(tagNames.length);
    expect(associated.length).toBe(tagsToInsert.length); // Should be 2 unique associations
  });

  it("should insert both positive and negative tags", async () => {
    const mixedTags = [
      { name: "positive-tag", type: "positive" as const },
      { name: "negative-tag", type: "negative" as const },
    ];
    const mediaIdForMixedTags = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a57";

    // Seed media for this test
    await db.insert(medias).values({
      id: mediaIdForMixedTags,
      sourceId: testSourceId,
      filePath: "/tag/test/mixed.jpg",
      fileName: "mixed.jpg",
      mediaType: "image",
      width: 100,
      height: 100,
    });

    await insertMediaTags(mediaIdForMixedTags, mixedTags, "manual");

    const associated = await db
      .select()
      .from(mediaTags)
      .where(eq(mediaTags.mediaId, mediaIdForMixedTags));

    expect(associated.length).toBe(mixedTags.length);
    expect(associated).toContainEqual(
      expect.objectContaining({ tagType: "positive" })
    );
    expect(associated).toContainEqual(
      expect.objectContaining({ tagType: "negative" })
    );
  });

  // Placeholder for a future selectAllTags function
  it("should select all tags", async () => {
    // const allTags = await selectAllTags();
    // expect(allTags.length).toBeGreaterThanOrEqual(1);
  });

  // Placeholder for a future deleteTag function
  it("should delete a tag and its associations", async () => {
    // const tagToDelete = await db.insert(tags).values({name: 'to-delete'}).returning();
    // await insertMediaTags(testMediaId, ['to-delete']);
    // await deleteTag(tagToDelete[0].id);
    // const found = await db.select().from(tags).where(eq(tags.id, tagToDelete[0].id));
    // expect(found.length).toBe(0);
    // const associations = await db.select().from(mediaTags).where(eq(mediaTags.tagId, tagToDelete[0].id));
    // expect(associations.length).toBe(0);
  });
});
