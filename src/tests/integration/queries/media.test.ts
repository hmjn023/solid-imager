import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import {
  deleteMedia,
  deleteMediaByPath,
  insertMedia,
  selectMediaById,
  selectMediaBySourceId,
  updateMedia,
} from "~/infrastructure/db/queries/media";
import {
  mediaSources,
  medias,
  type NewMedia,
} from "~/infrastructure/db/schema";

describe("media queries Integration", () => {
  const testSourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12";
  let testMediaId: string;

  beforeAll(async () => {
    // Clean up previous test data
    await db.delete(medias);
    await db.delete(mediaSources);

    // Seed a media source for the media to belong to
    await db.insert(mediaSources).values({
      id: testSourceId,
      name: "Media Test Source",
      type: "local",
      connectionInfo: { path: "/media/test" },
    });

    // Seed initial media data
    const initialMedia: NewMedia = {
      sourceId: testSourceId,
      filePath: "/media/test/initial.jpg",
      fileName: "initial.jpg",
      mediaType: "image",
      width: 100,
      height: 100,
    };
    const inserted = await db.insert(medias).values(initialMedia).returning();
    testMediaId = inserted[0].id;
  });

  afterAll(async () => {
    // Clean up all data
    await db.delete(medias);
    await db.delete(mediaSources);
  });

  it("should select media by its ID", async () => {
    const media = await selectMediaById(testMediaId);
    expect(media).toBeDefined();
    expect(media.id).toBe(testMediaId);
    expect(media.fileName).toBe("initial.jpg");
  });

  it("should throw NotFoundError when selecting non-existent media", async () => {
    const nonExistentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
    await expect(selectMediaById(nonExistentId)).rejects.toThrow(NotFoundError);
  });

  it("should insert new media", async () => {
    const newMedia: NewMedia = {
      sourceId: testSourceId,
      filePath: "/media/test/new.png",
      fileName: "new.png",
      mediaType: "image",
      width: 200,
      height: 200,
    };
    const inserted = await insertMedia(newMedia);
    expect(inserted).toBeDefined();
    expect(inserted.fileName).toBe("new.png");

    // Verify in DB
    const selected = await selectMediaById(inserted.id);
    expect(selected).toBeDefined();

    // Cleanup
    await deleteMedia(inserted.id);
  });

  it("should update existing media", async () => {
    const updatedFileName = "updated_initial.jpg";
    const updated = await updateMedia(testMediaId, {
      fileName: updatedFileName,
    });
    expect(updated).toBeDefined();
    expect(updated.fileName).toBe(updatedFileName);

    // Verify in DB
    const selected = await selectMediaById(testMediaId);
    expect(selected.fileName).toBe(updatedFileName);
  });

  it("should select all media for a given sourceId", async () => {
    const mediaList = await selectMediaBySourceId(testSourceId);
    expect(mediaList).toBeInstanceOf(Array);
    expect(mediaList.length).toBeGreaterThanOrEqual(1);
    expect(mediaList.every((m) => m.sourceId === testSourceId)).toBe(true);
  });

  it("should delete media by path", async () => {
    const mediaToDelete: NewMedia = {
      sourceId: testSourceId,
      filePath: "/media/test/to-delete-by-path/image.png",
      fileName: "image.png",
      mediaType: "image",
      width: 50,
      height: 50,
    };
    await insertMedia(mediaToDelete);

    const deleted = await deleteMediaByPath(
      testSourceId,
      "/media/test/to-delete-by-path"
    );
    expect(deleted.length).toBeGreaterThan(0);

    const result = await db
      .select()
      .from(medias)
      .where(eq(medias.filePath, mediaToDelete.filePath));
    expect(result.length).toBe(0);
  });

  it("should delete media by ID", async () => {
    const mediaToDelete: NewMedia = {
      sourceId: testSourceId,
      filePath: "/media/test/to-delete.jpg",
      fileName: "to-delete.jpg",
      mediaType: "image",
      width: 150,
      height: 150,
    };
    const inserted = await insertMedia(mediaToDelete);
    const insertedId = inserted.id;

    await deleteMedia(insertedId);

    // Verify it's gone
    await expect(selectMediaById(insertedId)).rejects.toThrow(NotFoundError);
  });
});
