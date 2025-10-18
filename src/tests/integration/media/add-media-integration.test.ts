import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { addMedia } from "~/infrastructure/api-clients/media";
import { db } from "~/infrastructure/db/index";
import type { NewMedia } from "~/infrastructure/db/schema";
import { medias } from "~/infrastructure/db/schema";

describe("addMedia Integration", () => {
  let addedMediaId: string | undefined;

  beforeEach(async () => {
    // 必要に応じて、以前のテストデータをクリーンアップします。
    await db.delete(medias);
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
      sourceId: "dce7b2a1-93ba-4c49-b1eb-f25dafb12949",
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
      addMedia(invalidMediaData as Partial<NewMedia>)
    ).rejects.toThrow(ZodError);
  });

  it("should throw an error if media with same sourceId and filePath already exists", async () => {
    const newMediaData = {
      sourceId: "dce7b2a1-93ba-4c49-b1eb-f25dafb12949",
      filePath: "/test/path/duplicate_image.png",
      fileName: "duplicate_image.png",
      size: 1024,
      mediaType: "image" as const,
      width: 800,
      height: 600,
    };

    await addMedia(newMediaData); // 最初のメディアを追加します。

    // 同じsourceIdとfilePathで再度追加を試みます。
    await expect(addMedia(newMediaData)).rejects.toThrow(
      "Media with this filePath already exists for the given sourceId"
    );
  });
});
