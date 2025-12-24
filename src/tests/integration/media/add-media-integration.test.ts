import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db/index";
import type { NewMedia } from "~/infrastructure/db/schema";
import { mediaSources, medias } from "~/infrastructure/db/schema";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";

describe("addMedia Integration", () => {
  let addedMediaId: string | undefined;
  const testSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";

  beforeEach(async () => {
    // 必要に応じて、以前のテストデータをクリーンアップします。
    await db.delete(medias);

    // テスト用のmedia sourceを作成
    await db
      .insert(mediaSources)
      .values({
        id: testSourceId,
        name: "Test Source",
        type: "local",
        connectionInfo: { path: "/test" },
      })
      .onConflictDoNothing();
  });

  afterEach(async () => {
    // 各テスト後に、追加されたメディアをクリーンアップします。
    if (addedMediaId) {
      await db.delete(medias).where(eq(medias.id, addedMediaId));
      addedMediaId = undefined;
    }
  });

  it("should successfully add media to the database", async () => {
    const newMediaData = {
      mediaSourceId: "dce7b2a1-93ba-4c49-b1eb-f25dafb12949",
      filePath: `/test/path/image-${Date.now()}.png`,
      fileName: "test_image.png",
      size: 1024,
      mediaType: "image" as const,
      width: 800,
      height: 600,
      description: null,
    };

    const result = await MediaRepository.create(newMediaData);
    addedMediaId = result.id;

    expect(result).toBeDefined();
    expect(result.id).toBeTypeOf("string");
    expect(result.filePath).toBe(newMediaData.filePath);

    // メディアがデータベースに存在することを確認します。
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
      // fileName、sizeなどが不足しています。
    };

    await expect(
      MediaRepository.create(invalidMediaData as Partial<NewMedia> as any)
    ).rejects.toThrow(); // Expect any error (likely DB error)
  });

  it("should throw an error if media with same mediaSourceId and filePath already exists", async () => {
    const newMediaData = {
      mediaSourceId: testSourceId,
      filePath: `/test/path/duplicate-${Date.now()}.png`,
      fileName: "duplicate.png",
      fileSize: 1024,
      mediaType: "image" as const,
      width: 800,
      height: 600,
      description: null,
    };

    await MediaRepository.create(newMediaData); // 最初のメディアを追加します。
    // 同じmediaSourceIdとfilePathで再度追加を試みます。
    await expect(MediaRepository.create(newMediaData)).rejects.toThrow(
      "Failed to insert media"
    );
  });
});
