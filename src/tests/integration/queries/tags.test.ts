import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  const testMediaSourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13";
  let testMediaId: string;

  beforeAll(async () => {
    // Clean up
    await db.delete(mediaTags);
    await db.delete(tags);
    await db.delete(medias);
    await db.delete(mediaSources);

    // Seed media source
    await db.insert(mediaSources).values({
      id: testMediaSourceId,
      name: "Tag Test Source",
      type: "local",
      connectionInfo: { path: "/tag/test" },
    });

    // Seed media
    const initialMedia: NewMedia = {
      mediaSourceId: testMediaSourceId,
      filePath: "/tag/test/initial.jpg",
      fileName: "initial.jpg",
      mediaType: "image",
      width: 100,
      height: 100,
    };
    const inserted = await db.insert(medias).values(initialMedia).returning();
    testMediaId = inserted[0].id;
  });

  afterAll(async () => {
    // Final cleanup
    await db.delete(mediaTags);
    await db.delete(tags);
    await db.delete(medias);
    await db.delete(mediaSources);
  });

  it("should insert new tags and associate them with media", async () => {
    const newTags = ["tag1", "tag2", "new-tag"];
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
  });

  it("should not create duplicate tags or associations", async () => {
    const tagsToInsert = ["unique-tag1", "unique-tag2"];
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
