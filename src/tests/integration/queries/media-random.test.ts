import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { selectRandomMedia } from "~/infrastructure/db/queries/media-random";
import {
  mediaSources,
  medias,
  type NewMedia,
} from "~/infrastructure/db/schema";

describe("media-random queries Integration", () => {
  const sourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16";

  beforeAll(async () => {
    await db.delete(medias);
    await db.delete(mediaSources);

    await db.insert(mediaSources).values({
      id: sourceId,
      name: "random-test",
      type: "local",
      connectionInfo: { path: "/" },
    });

    const mediaToInsert: NewMedia[] = [
      {
        sourceId,
        filePath: "1.jpg",
        fileName: "1.jpg",
        mediaType: "image",
        width: 1,
        height: 1,
      },
      {
        sourceId,
        filePath: "2.jpg",
        fileName: "2.jpg",
        mediaType: "image",
        width: 1,
        height: 1,
      },
    ];
    await db.insert(medias).values(mediaToInsert);
  });

  afterAll(async () => {
    await db.delete(medias);
    await db.delete(mediaSources);
  });

  it("should select a random media from the source", async () => {
    const randomMedia = await selectRandomMedia(sourceId);
    expect(randomMedia).toBeDefined();
    expect(randomMedia.sourceId).toBe(sourceId);
  });
});
