import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { db } from "~/db";
import { medias } from "~/db/schema";
import { addMedia, deleteMedia, getMedia } from "~/lib/api/media";

describe("deleteMedia Integration", () => {
  let testMediaId: string;
  const testSourceId = "b0000000-0000-0000-0000-000000000000";
  const initialMediaData = {
    sourceId: testSourceId,
    filePath: "/test/path/delete_image.png",
    fileName: "delete_image.png",
    size: 512,
    mediaType: "image" as const,
    width: 400,
    height: 300,
  };

  beforeEach(async () => {
    // Add an initial media entry to the database
    const addedMedia = await addMedia(initialMediaData);
    testMediaId = addedMedia.id;
  });

  afterEach(async () => {
    // Ensure media is deleted after each test, even if test fails
    try {
      await db.delete(medias).where(eq(medias.id, testMediaId));
    } catch (_error) {
      // Ignore if already deleted by the test
    }
  });

  it("should successfully delete media from the database", async () => {
    const result = await deleteMedia(testSourceId, testMediaId);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // Verify that the media is no longer in the database
    await expect(getMedia(testSourceId, testMediaId)).rejects.toThrow(
      "Media not found"
    );
  });

  it("should throw an error if mediaId is not found for the given sourceId", async () => {
    const nonExistentId = "a0000000-0000-0000-0000-000000000000";
    await expect(deleteMedia(testSourceId, nonExistentId)).rejects.toThrow(
      "Media not found"
    );
  });

  it("should throw a ZodError for an invalid mediaId format", async () => {
    const invalidId = "invalid-uuid";
    await expect(deleteMedia(testSourceId, invalidId)).rejects.toThrow(
      ZodError
    );
  });

  it("should throw a ZodError for an invalid sourceId format", async () => {
    const invalidSourceId = "invalid-source-id";
    await expect(deleteMedia(invalidSourceId, testMediaId)).rejects.toThrow(
      ZodError
    );
  });
});
