import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { addMedia, deleteMedia } from "~/infrastructure/api-clients/media";
import { db } from "~/infrastructure/db/index";
import type { NewMedia } from "~/infrastructure/db/schema";
import { medias } from "~/infrastructure/db/schema";

describe("deleteMedia Integration", () => {
  let testMediaId: string;
  const sourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";

  beforeAll(async () => {
    await db.delete(medias).where(sql`true`);
    const initialMediaData: NewMedia = {
      sourceId,
      filePath: `/test/path/to_delete-${Date.now()}.png`,
      fileName: "to_delete.png",
      size: 1024,
      mediaType: "image",
      width: 800,
      height: 600,
    };
    // データベースに初期メディアエントリを追加します。
    const addedMedia = await addMedia(initialMediaData);
    testMediaId = addedMedia.id;
  });

  afterAll(async () => {
    // クリーンアップ
    await db.delete(medias).where(sql`true`);
  });

  it("should successfully delete media from the database", async () => {
    const result = await deleteMedia(sourceId, testMediaId);
    expect(result.success).toBe(true);

    // メディアがデータベースから削除されたことを確認します。
    const mediaInDb = await db
      .select()
      .from(medias)
      .where(eq(medias.id, testMediaId));
    expect(mediaInDb.length).toBe(0);
  });

  it("should throw an error if mediaId is not found for the given sourceId", async () => {
    const nonExistentMediaId = "a0000000-0000-4000-8000-000000000000";
    await expect(deleteMedia(sourceId, nonExistentMediaId)).rejects.toThrow(
      "Media not found"
    );
  });

  it("should throw a ZodError for an invalid mediaId format", async () => {
    const invalidMediaId = "invalid-uuid";
    await expect(deleteMedia(sourceId, invalidMediaId)).rejects.toBeInstanceOf(
      ZodError
    );
  });

  it("should throw a ZodError for an invalid sourceId format", async () => {
    const invalidSourceId = "invalid-uuid";
    await expect(
      deleteMedia(invalidSourceId, testMediaId)
    ).rejects.toBeInstanceOf(ZodError);
  });
});
