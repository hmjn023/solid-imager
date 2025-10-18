import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { addMedia, listMedia } from "~/infrastructure/api-clients/media";
import { db } from "~/infrastructure/db/index";
import type { NewMedia } from "~/infrastructure/db/schema";
import { medias } from "~/infrastructure/db/schema";
import { TestDatabaseLive } from "~/tests/db/test-layer";

describe("listMedia Integration", () => {
  const sourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
  const directoryPath = "/test/path";
  const addedMediaIds: string[] = [];

  const mediaEntries: NewMedia[] = [
    {
      sourceId,
      filePath: `${directoryPath}/image1.png`,
      fileName: "image1.png",
      size: 1024,
      mediaType: "image",
      width: 800,
      height: 600,
    },
    {
      sourceId,
      filePath: `${directoryPath}/image2.png`,
      fileName: "image2.png",
      size: 2048,
      mediaType: "image",
      width: 1024,
      height: 768,
    },
    {
      sourceId: "a0000000-0000-4000-8000-000000000000", // 別のsourceId
      filePath: `${directoryPath}/other_image.png`,
      fileName: "other_image.png",
      size: 1024,
      mediaType: "image",
      width: 800,
      height: 600,
    },
  ];

  beforeAll(async () => {
    await db.delete(medias);
    for (const data of mediaEntries) {
      const added = await Effect.runPromise(
        Effect.provide(addMedia(data), TestDatabaseLive)
      );
      addedMediaIds.push(added.id);
    }
  });

  afterAll(async () => {
    await db.delete(medias);
  });

  it("should return all media files within the specified directory for the given sourceId", async () => {
    const result = await Effect.runPromise(
      Effect.provide(listMedia(sourceId, directoryPath), TestDatabaseLive)
    );
    expect(result.length).toBe(2);
    expect(result.every((m) => m.sourceId === sourceId)).toBe(true);
    expect(result.map((m) => m.fileName).sort()).toEqual([
      "image1.png",
      "image2.png",
    ]);
  });

  it("should return an empty array if directoryPath contains no media files for the given sourceId", async () => {
    const emptyDirectoryPath = "/test/empty_path";
    const result = await Effect.runPromise(
      Effect.provide(listMedia(sourceId, emptyDirectoryPath), TestDatabaseLive)
    );
    expect(result.length).toBe(0);
  });

  it("should throw a ZodError if directoryPath is empty", async () => {
    const effect = listMedia(sourceId, "");
    const exit = await Effect.runPromiseExit(
      Effect.provide(effect, TestDatabaseLive)
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(exit.cause.value).toBeInstanceOf(ZodError);
    }
  });

  it("should throw a ZodError if sourceId is invalid", async () => {
    const invalidSourceId = "invalid-uuid";
    const effect = listMedia(invalidSourceId, directoryPath);
    const exit = await Effect.runPromiseExit(
      Effect.provide(effect, TestDatabaseLive)
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(exit.cause.value).toBeInstanceOf(ZodError);
    }
  });
});
