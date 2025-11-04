import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { selectRecentMedia } from "~/infrastructure/db/queries/media-recent";
import {
  mediaSources,
  medias,
  type NewMedia,
} from "~/infrastructure/db/schema";

describe("selectRecentMedia DB", () => {
  const mediaSourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19";
  const TenSecondsAgo = 10_000;
  const FiveSecondsAgo = 5000;
  const ExpectedMediaCount = 3;

  beforeAll(async () => {
    await db.delete(medias).where(sql`true`);
    await db.delete(mediaSources).where(sql`true`);

    await db.insert(mediaSources).values({
      id: mediaSourceId,
      name: "recent-test-db",
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
        createdAt: new Date(Date.now() - TenSecondsAgo),
      },
      {
        mediaSourceId,
        filePath: "2.jpg",
        fileName: "2.jpg",
        mediaType: "image",
        width: 1,
        height: 1,
        createdAt: new Date(Date.now() - FiveSecondsAgo),
      },
      {
        mediaSourceId,
        filePath: "3.jpg",
        fileName: "3.jpg",
        mediaType: "image",
        width: 1,
        height: 1,
        createdAt: new Date(),
      },
    ];
    await db.insert(medias).values(mediaToInsert);
  });

  afterAll(async () => {
    await db.delete(medias).where(sql`true`);
    await db.delete(mediaSources).where(sql`true`);
  });

  it("should return a list of recent media on success", async () => {
    const recentMedia = await selectRecentMedia(mediaSourceId);
    expect(recentMedia).toBeInstanceOf(Array);
    expect(recentMedia.length).toBe(ExpectedMediaCount);
    expect(recentMedia[0].fileName).toBe("3.jpg");
    expect(recentMedia[1].fileName).toBe("2.jpg");
    expect(recentMedia[2].fileName).toBe("1.jpg");
  });

  it("should return an empty array if no recent media found", async () => {
    const nonExistentSourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99";
    const result = await selectRecentMedia(nonExistentSourceId);
    expect(result).toEqual([]);
  });
});
