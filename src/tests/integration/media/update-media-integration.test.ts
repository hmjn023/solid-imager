import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  addMedia,
  getMedia,
  updateMedia,
} from "~/infrastructure/api-clients/media";
import { db } from "~/infrastructure/db/index";
import { medias } from "~/infrastructure/db/schema";
import { TestDatabaseLive } from "~/tests/db/test-layer";

describe("updateMedia Integration", () => {
  let testMediaId: string;
  // const testSourceId = "b0000000-0000-0000-0000-000000000000";
  const testSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
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
    const addedMedia = await Effect.runPromise(
      Effect.provide(addMedia(initialMediaData), TestDatabaseLive)
    );
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

    const updatedMedia = await Effect.runPromise(
      Effect.provide(
        updateMedia(testSourceId, testMediaId, updates),
        TestDatabaseLive
      )
    );

    expect(updatedMedia).toBeDefined();
    expect(updatedMedia.id).toBe(testMediaId);
    expect(updatedMedia.fileName).toBe(updates.fileName);
    expect(updatedMedia.description).toBe(updates.description);
    expect(updatedMedia.width).toBe(updates.width);
    expect(updatedMedia.updatedAt).toBeInstanceOf(Date);

    // 変更がデータベースに永続化されていることを確認します。
    const mediaInDb = await Effect.runPromise(
      Effect.provide(getMedia(testSourceId, testMediaId), TestDatabaseLive)
    );
    expect(mediaInDb.fileName).toBe(updates.fileName);
    expect(mediaInDb.description).toBe(updates.description);
    expect(mediaInDb.width).toBe(updates.width);
  });

  it("should throw an error if mediaId is not found for the given sourceId", async () => {
    const nonExistentId = "a0000000-0000-0000-0000-000000000000";
    const updates = { fileName: "non_existent.png" };
    const effect = updateMedia(testSourceId, nonExistentId, updates);
    const exit = await Effect.runPromiseExit(
      Effect.provide(effect, TestDatabaseLive)
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(exit.cause.value).toBeInstanceOf(Error);
      expect((exit.cause.value as Error).message).toBe("Media not found");
    }
  });

  it("should throw a ZodError for an invalid mediaId format", async () => {
    const invalidId = "invalid-uuid";
    const updates = { fileName: "test.png" };
    const effect = updateMedia(testSourceId, invalidId, updates);
    const exit = await Effect.runPromiseExit(
      Effect.provide(effect, TestDatabaseLive)
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(exit.cause.value).toBeInstanceOf(ZodError);
    }
  });

  it("should throw a ZodError for an invalid sourceId format", async () => {
    const invalidSourceId = "invalid-uuid";
    const updates = { fileName: "test.png" };
    const effect = updateMedia(invalidSourceId, testMediaId, updates);
    const exit = await Effect.runPromiseExit(
      Effect.provide(effect, TestDatabaseLive)
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(exit.cause.value).toBeInstanceOf(ZodError);
    }
  });

  it("should throw a ZodError for invalid update data", async () => {
    const invalidUpdates = { width: -100 }; // 無効なフィールド
    const effect = updateMedia(
      testSourceId,
      testMediaId,
      invalidUpdates as any
    );
    const exit = await Effect.runPromiseExit(
      Effect.provide(effect, TestDatabaseLive)
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(exit.cause.value).toBeInstanceOf(ZodError);
    }
  });
});
