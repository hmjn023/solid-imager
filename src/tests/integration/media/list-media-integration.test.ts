import { eq, like } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { db } from "~/db/index";
import { medias } from "~/db/schema";
import { addMedia, listMedia } from "~/infrastructure/api-clients/media";

describe("listMedia Integration", () => {
  const testSourceId = "b0000000-0000-0000-0000-000000000000";
  const testDirectory = "/test/path/list_media/";
  const mediaEntries = [
    {
      sourceId: testSourceId,
      filePath: `${testDirectory}image1.png`,
      fileName: "image1.png",
      size: 100,
      mediaType: "image" as const,
      width: 100,
      height: 100,
    },
    {
      sourceId: testSourceId,
      filePath: `${testDirectory}image2.png`,
      fileName: "image2.png",
      size: 200,
      mediaType: "image" as const,
      width: 200,
      height: 200,
    },
    {
      sourceId: "c0000000-0000-0000-0000-000000000000", // 異なるsourceId
      filePath: "/another/path/image3.png",
      fileName: "image3.png",
      size: 300,
      mediaType: "image" as const,
      width: 300,
      height: 300,
    },
  ];
  let addedMediaIds: string[] = [];

  beforeEach(async () => {
    // 以前のテストデータをクリーンアップします。
    await db.delete(medias).where(like(medias.filePath, `${testDirectory}%`));
    await db
      .delete(medias)
      .where(eq(medias.filePath, "/another/path/image3.png"));

    // テストメディアエントリを追加します。
    for (const data of mediaEntries) {
      const added = await addMedia(data);
      addedMediaIds.push(added.id);
    }
  });

  afterEach(async () => {
    // 各テスト後に、追加されたすべてのメディアをクリーンアップします。
    for (const id of addedMediaIds) {
      await db.delete(medias).where(eq(medias.id, id));
    }
    addedMediaIds = [];
  });

  it("should return all media files within the specified directory for the given sourceId", async () => {
    const result = await listMedia(testSourceId, testDirectory);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2); // testSourceIdのtestDirectoryには2つのメディアエントリのみが存在します。

    const fileNames = result.map((m) => m.fileName).sort();
    expect(fileNames).toEqual(["image1.png", "image2.png"]);
  });

  it("should return an empty array if directoryPath contains no media files for the given sourceId", async () => {
    const emptyDirectory = "/test/path/empty_folder/";
    const result = await listMedia(testSourceId, emptyDirectory);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("should throw a ZodError if directoryPath is empty", async () => {
    await expect(listMedia(testSourceId, "")).rejects.toThrow(ZodError);
  });

  it("should throw a ZodError if sourceId is invalid", async () => {
    const invalidSourceId = "invalid-source-id";
    await expect(listMedia(invalidSourceId, testDirectory)).rejects.toThrow(
      ZodError
    );
  });
});
