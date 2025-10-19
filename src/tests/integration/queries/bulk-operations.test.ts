import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import {
  bulkAddMediaTags,
  bulkDeleteMedia,
  bulkRemoveMediaTags,
  bulkUpdateMedia,
  bulkUpdateMediaPaths,
} from "~/infrastructure/db/queries/bulk-operations";
import {
  mediaSources,
  medias,
  mediaTags,
  type NewMedia,
  type NewTag,
  tags,
} from "~/infrastructure/db/schema";

describe("bulk-operations queries Integration", () => {
  const sourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19";
  let mediaIds: string[];
  let tagIds: number[];

  beforeAll(async () => {
    await db.delete(mediaTags).where(sql`true`);
    await db.delete(tags).where(sql`true`);
    await db.delete(medias).where(sql`true`);
    await db.delete(mediaSources).where(sql`true`);

    await db.insert(mediaSources).values({
      id: sourceId,
      name: "bulk-test",
      type: "local",
      connectionInfo: { path: "/" },
    });

    const mediaToInsert: NewMedia[] = [
      {
        sourceId,
        filePath: "bulk1.jpg",
        fileName: "bulk1.jpg",
        description: "desc1",
        mediaType: "image",
        width: 1,
        height: 1,
      },
      {
        sourceId,
        filePath: "bulk2.jpg",
        fileName: "bulk2.jpg",
        description: "desc2",
        mediaType: "image",
        width: 1,
        height: 1,
      },
      {
        sourceId,
        filePath: "bulk3.jpg",
        fileName: "bulk3.jpg",
        description: "desc3",
        mediaType: "image",
        width: 1,
        height: 1,
      },
    ];
    const insertedMedia = await db
      .insert(medias)
      .values(mediaToInsert)
      .returning();
    mediaIds = insertedMedia.map((m) => m.id);

    const tagsToInsert: NewTag[] = [
      { name: "bulk-tag1" },
      { name: "bulk-tag2" },
    ];
    const insertedTags = await db.insert(tags).values(tagsToInsert).returning();
    tagIds = insertedTags.map((t) => t.id);
  });

  afterAll(async () => {
    await db.delete(mediaTags).where(sql`true`);
    await db.delete(tags).where(sql`true`);
    await db.delete(medias).where(sql`true`);
    await db.delete(mediaSources).where(sql`true`);
  });

  it("should bulk update media descriptions", async () => {
    const results = await bulkUpdateMedia(sourceId, mediaIds, {
      description: "bulk updated",
    });
    expect(results.length).toBe(mediaIds.length);
    for (const r of results) {
      expect(r.description).toBe("bulk updated");
    }
  });

  it("should bulk add and remove tags", async () => {
    await bulkAddMediaTags(sourceId, mediaIds, tagIds);
    let associations = await db.select().from(mediaTags);
    expect(associations.length).toBe(mediaIds.length * tagIds.length);

    await bulkRemoveMediaTags(sourceId, [mediaIds[0]], [tagIds[0]]);
    associations = await db.select().from(mediaTags);
    expect(associations.length).toBe(mediaIds.length * tagIds.length - 1);
  });

  it("should bulk update media paths", async () => {
    await bulkUpdateMediaPaths(sourceId, mediaIds, "new/path");
    const updatedMedia = await db
      .select()
      .from(medias)
      .where(sql`id IN ${mediaIds}`);
    for (const m of updatedMedia) {
      expect(m.filePath.startsWith("new/path")).toBe(true);
    }
  });

  it("should bulk delete media", async () => {
    const mediaToDelete: NewMedia[] = [
      {
        sourceId,
        filePath: "del1.jpg",
        fileName: "del1.jpg",
        mediaType: "image",
        width: 1,
        height: 1,
      },
      {
        sourceId,
        filePath: "del2.jpg",
        fileName: "del2.jpg",
        mediaType: "image",
        width: 1,
        height: 1,
      },
    ];
    const inserted = await db.insert(medias).values(mediaToDelete).returning();
    const idsToDelete = inserted.map((m) => m.id);

    const results = await bulkDeleteMedia(sourceId, idsToDelete);
    expect(results.length).toBe(idsToDelete.length);

    const remaining = await db
      .select()
      .from(medias)
      .where(sql`id IN ${idsToDelete}`);
    expect(remaining.length).toBe(0);
  });
});
