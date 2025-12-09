import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { selectRecentMedia } from "~/infrastructure/db/queries/media-recent";
import {
  mediaSources,
  medias,
  type NewMedia,
} from "~/infrastructure/db/schema";

describe("media-recent queries Integration", () => {
  const mediaSourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17";
  const TenSecondsAgo = 10_000;
  const FiveSecondsAgo = 5000;
  const ExpectedMediaCount = 3; // Defined at top level

  beforeAll(async () => {
    await db.delete(medias);
    await db.delete(mediaSources);

    await db.insert(mediaSources).values({
      id: mediaSourceId,
      name: "recent-test",
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
    await db.delete(medias);
    await db.delete(mediaSources);
  });

  it("should select the most recent media from the source", async () => {
    const recentMedia = await selectRecentMedia(mediaSourceId);
    expect(recentMedia).toBeInstanceOf(Array);
    expect(recentMedia.length).toBe(ExpectedMediaCount);
    expect(recentMedia[0].fileName).toBe("3.jpg");
    expect(recentMedia[1].fileName).toBe("2.jpg");
    expect(recentMedia[2].fileName).toBe("1.jpg");
  });
});
