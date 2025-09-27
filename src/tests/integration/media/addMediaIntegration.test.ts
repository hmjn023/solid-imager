import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { db } from "~/db";
import { medias } from "~/db/schema";
import { addMedia } from "~/lib/api/media";

describe("addMedia Integration", () => {
  let addedMediaId: string | undefined;

  beforeEach(async () => {
    // Clean up any previous test data if necessary
    await db.delete(medias);
  });

  afterEach(async () => {
    // Clean up the added media after each test
    if (addedMediaId) {
      await db.delete(medias).where(eq(medias.id, addedMediaId));
      addedMediaId = undefined;
    }
  });

  it("should successfully add media to the database", async () => {
    const newMediaData = {
      sourceId: "b0000000-0000-0000-0000-000000000000",
      filePath: "/test/path/image.png",
      fileName: "test_image.png",
      size: 1024,
      mediaType: "image" as const,
      width: 800,
      height: 600,
    };

    const result = await addMedia(newMediaData);
    addedMediaId = result.id;

    expect(result).toBeDefined();
    expect(result.id).toBeTypeOf("string");
    expect(result.filePath).toBe(newMediaData.filePath);

    // Verify that the media is in the database
    const mediaInDb = await db
      .select()
      .from(medias)
      .where(eq(medias.id, result.id));
    expect(mediaInDb.length).toBe(1);
    expect(mediaInDb[0].fileName).toBe(newMediaData.fileName);
  });

  it("should throw a ZodError if required fields are missing or invalid", async () => {
    const invalidMediaData = {
      filePath: "/test/path/image.png",
      // Missing fileName, size, etc.
    };

    await expect(addMedia(invalidMediaData as any)).rejects.toThrow(ZodError);
  });

  it("should throw an error if media with same sourceId and filePath already exists", async () => {
    const newMediaData = {
      sourceId: "b0000000-0000-0000-0000-000000000000",
      filePath: "/test/path/duplicate_image.png",
      fileName: "duplicate_image.png",
      size: 1024,
      mediaType: "image" as const,
      width: 800,
      height: 600,
    };

    await addMedia(newMediaData); // Add the first media

    // Attempt to add again with the same sourceId and filePath
    await expect(addMedia(newMediaData)).rejects.toThrow(
      "Media with this filePath already exists for the given sourceId"
    );
  });
});
