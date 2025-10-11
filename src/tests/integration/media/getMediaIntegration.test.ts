import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { addMedia, getMedia } from "~/infrastructure/api-clients/media";
import { db } from "~/infrastructure/db";
import { medias } from "~/infrastructure/db/schema";

describe("getMedia Integration", () => {
  let testMediaId: string;
  const testSourceId = "b0000000-0000-0000-0000-000000000000";
  const newMediaData = {
    sourceId: testSourceId,
    filePath: "/test/path/get_image.png",
    fileName: "get_image.png",
    size: 2048,
    mediaType: "image" as const,
    width: 1024,
    height: 768,
  };

  beforeEach(async () => {
    // getMediaをテストするために、データベースにメディアエントリを追加します。
    const addedMedia = await addMedia(newMediaData);
    testMediaId = addedMedia.id;
  });

  afterEach(async () => {
    // 各テスト後に、追加されたメディアをクリーンアップします。
    if (testMediaId) {
      await db.delete(medias).where(eq(medias.id, testMediaId));
    }
  });

  it("should successfully retrieve media from the database", async () => {
    const retrievedMedia = await getMedia(testSourceId, testMediaId);

    expect(retrievedMedia).toBeDefined();
    expect(retrievedMedia.id).toBe(testMediaId);
    expect(retrievedMedia.fileName).toBe(newMediaData.fileName);
    expect(retrievedMedia.filePath).toBe(newMediaData.filePath);
    expect(retrievedMedia.sourceId).toBe(testSourceId);
  });

  it("should throw an error if mediaId is not found for the given sourceId", async () => {
    const nonExistentId = "a0000000-0000-0000-0000-000000000000"; // 有効だが存在しないUUID
    await expect(getMedia(testSourceId, nonExistentId)).rejects.toThrow(
      "Media not found"
    );
  });

  it("should throw a ZodError for an invalid mediaId format", async () => {
    const invalidId = "invalid-uuid";
    await expect(getMedia(testSourceId, invalidId)).rejects.toThrow(ZodError);
  });

  it("should throw a ZodError for an invalid sourceId format", async () => {
    const invalidSourceId = "invalid-source-id";
    await expect(getMedia(invalidSourceId, testMediaId)).rejects.toThrow(
      ZodError
    );
  });
});
