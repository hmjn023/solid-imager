import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { db } from "~/db/db";
import { medias } from "~/db/schema";
import { addMedia, getMedia, updateMedia } from "~/lib/api/media";

describe("updateMedia Integration", () => {
  let testMediaId: string;
  const testSourceId = "b0000000-0000-0000-0000-000000000000";
  const initialMediaData = {
    sourceId: testSourceId,
    filePath: "/test/path/initial_image.png",
    fileName: "initial_image.png",
    size: 1024,
    mediaType: "image" as const,
    width: 800,
    height: 600,
  };

  beforeEach(async () => {
    // データベースに初期メディアエントリを追加します。
    const addedMedia = await addMedia(initialMediaData);
    testMediaId = addedMedia.id;
  });

  afterEach(async () => {
    // 各テスト後に、追加されたメディアをクリーンアップします。
    if (testMediaId) {
      await db.delete(medias).where(eq(medias.id, testMediaId));
    }
  });

  it("should successfully update media in the database", async () => {
    const updates = {
      fileName: "updated_image.png",
      description: "This is an updated description",
      width: 1200,
    };

    const updatedMedia = await updateMedia(testSourceId, testMediaId, updates);

    expect(updatedMedia).toBeDefined();
    expect(updatedMedia.id).toBe(testMediaId);
    expect(updatedMedia.fileName).toBe(updates.fileName);
    expect(updatedMedia.description).toBe(updates.description);
    expect(updatedMedia.width).toBe(updates.width);
    expect(updatedMedia.updatedAt).toBeInstanceOf(Date);

    // 変更がデータベースに永続化されていることを確認します。
    const mediaInDb = await getMedia(testSourceId, testMediaId);
    expect(mediaInDb.fileName).toBe(updates.fileName);
    expect(mediaInDb.description).toBe(updates.description);
    expect(mediaInDb.width).toBe(updates.width);
  });

  it("should throw an error if mediaId is not found for the given sourceId", async () => {
    const nonExistentId = "a0000000-0000-0000-0000-000000000000";
    const updates = { fileName: "non_existent.png" };
    await expect(
      updateMedia(testSourceId, nonExistentId, updates)
    ).rejects.toThrow("Media not found");
  });

  it("should throw a ZodError for an invalid mediaId format", async () => {
    const invalidId = "invalid-uuid";
    const updates = { fileName: "test.png" };
    await expect(updateMedia(testSourceId, invalidId, updates)).rejects.toThrow(
      ZodError
    );
  });

  it("should throw a ZodError for an invalid sourceId format", async () => {
    const invalidSourceId = "invalid-source-id";
    const updates = { fileName: "test.png" };
    await expect(
      updateMedia(invalidSourceId, testMediaId, updates)
    ).rejects.toThrow(ZodError);
  });

  it("should throw a ZodError for invalid update data", async () => {
    const invalidUpdates = { width: -100 }; // 無効なフィールド
    await expect(
      updateMedia(testSourceId, testMediaId, invalidUpdates as any)
    ).rejects.toThrow(ZodError);
  });
});
