import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { addMedia, getMedia } from "~/infrastructure/api-clients/media";
import { db } from "~/infrastructure/db/index";
import type { NewMedia } from "~/infrastructure/db/schema";
import { mediaSources, medias } from "~/infrastructure/db/schema";

const MEDIA_NOT_FOUND_PATTERN = /Media.*not found/;

describe("getMedia Integration", () => {
  let testMediaId: string;
  const sourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
  const newMediaData: NewMedia = {
    sourceId,
    filePath: `/test/path/image-${Date.now()}.png`,
    fileName: "test_image.png",
    size: 1024,
    mediaType: "image",
    width: 800,
    height: 600,
  };

  beforeAll(async () => {
    await db.delete(medias).where(sql`true`);

    // テスト用のmedia sourceを作成
    await db
      .insert(mediaSources)
      .values({
        id: sourceId,
        name: "Test Source",
        type: "local",
        connectionInfo: { path: "/test" },
      })
      .onConflictDoNothing();
    // getMediaをテストするために、データベースにメディアエントリを追加します。
    const addedMedia = await addMedia(newMediaData);
    testMediaId = addedMedia.id;
  });

  afterAll(async () => {
    await db.delete(medias).where(sql`true`);
  });

  it("should successfully retrieve media from the database", async () => {
    const result = await getMedia(sourceId, testMediaId);
    expect(result).toBeDefined();
    expect(result.id).toBe(testMediaId);
    expect(result.fileName).toBe(newMediaData.fileName);
  });

  it("should throw an error if mediaId is not found for the given sourceId", async () => {
    const nonExistentMediaId = "a0000000-0000-4000-8000-000000000000";
    await expect(getMedia(sourceId, nonExistentMediaId)).rejects.toThrow(
      MEDIA_NOT_FOUND_PATTERN
    );
  });

  it("should throw a ZodError for an invalid mediaId format", async () => {
    const invalidMediaId = "invalid-uuid";
    await expect(getMedia(sourceId, invalidMediaId)).rejects.toBeInstanceOf(
      ZodError
    );
  });

  it("should throw a ZodError for an invalid sourceId format", async () => {
    const invalidSourceId = "invalid-uuid";
    await expect(getMedia(invalidSourceId, testMediaId)).rejects.toBeInstanceOf(
      ZodError
    );
  });
});
