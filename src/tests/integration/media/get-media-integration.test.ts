import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { addMedia, getMedia } from "~/infrastructure/api-clients/media";
import { db } from "~/infrastructure/db/index";
import type { NewMedia } from "~/infrastructure/db/schema";
import { medias } from "~/infrastructure/db/schema";
import { TestDatabaseLive } from "~/tests/db/test-layer";

describe("getMedia Integration", () => {
  let testMediaId: string;
  const sourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
  const newMediaData: NewMedia = {
    sourceId,
    filePath: "/test/path/image.png",
    fileName: "test_image.png",
    size: 1024,
    mediaType: "image",
    width: 800,
    height: 600,
  };

  beforeAll(async () => {
    await db.delete(medias);
    // getMediaをテストするために、データベースにメディアエントリを追加します。
    const addedMedia = await Effect.runPromise(
      Effect.provide(addMedia(newMediaData), TestDatabaseLive)
    );
    testMediaId = addedMedia.id;
  });

  afterAll(async () => {
    await db.delete(medias);
  });

  it("should successfully retrieve media from the database", async () => {
    const result = await Effect.runPromise(
      Effect.provide(getMedia(sourceId, testMediaId), TestDatabaseLive)
    );
    expect(result).toBeDefined();
    expect(result.id).toBe(testMediaId);
    expect(result.fileName).toBe(newMediaData.fileName);
  });

  it("should throw an error if mediaId is not found for the given sourceId", async () => {
    const nonExistentMediaId = "a0000000-0000-4000-8000-000000000000";
    const effect = getMedia(sourceId, nonExistentMediaId);
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
    const invalidMediaId = "invalid-uuid";
    const effect = getMedia(sourceId, invalidMediaId);
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
    const effect = getMedia(invalidSourceId, testMediaId);
    const exit = await Effect.runPromiseExit(
      Effect.provide(effect, TestDatabaseLive)
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(exit.cause.value).toBeInstanceOf(ZodError);
    }
  });
});
