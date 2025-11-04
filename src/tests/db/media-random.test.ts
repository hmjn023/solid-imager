import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import { selectRandomMedia } from "~/infrastructure/db/queries/media-random";
import {
  mediaSources,
  medias,
  type NewMedia,
} from "~/infrastructure/db/schema";

describe("selectRandomMedia DB", () => {
  const mediaSourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18";

  beforeAll(async () => {
    await db.delete(medias).where(sql`true`);
    await db.delete(mediaSources).where(sql`true`);

    await db.insert(mediaSources).values({
      id: mediaSourceId,
      name: "random-test-db",
      type: "local",
      connectionInfo: { path: "/" },
    });

    const mediaToInsert: NewMedia[] = [
      {
        mediaSourceId,
        filePath: "1.jpg",
        fileName: "1.jpg",
        mediaType: "image",
        width: 1,
        height: 1,
      },
      {
        mediaSourceId,
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
    await db.delete(medias).where(sql`true`);
    await db.delete(mediaSources).where(sql`true`);
  });

  it("should return a random media item on success", async () => {
    const randomMedia = await selectRandomMedia(mediaSourceId);
    expect(randomMedia).toBeDefined();
    expect(randomMedia.mediaSourceId).toBe(mediaSourceId);
  });

  it("should return NotFoundError if no random media found", async () => {
    const nonExistentSourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99";
    await expect(selectRandomMedia(nonExistentSourceId)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });
});
