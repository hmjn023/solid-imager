import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db/index";
import {
  mediaSources,
  medias,
  type NewMedia,
} from "~/infrastructure/db/schema";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { globalSearchMedia } from "~/infrastructure/repositories/media-repository-utils";

describe("MediaRepository Pagination & Ordering", () => {
  const mediaSourceId = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a14";
  const TotalItems = 105;
  const LargeLimit = 1000;
  const PageSize = 10;
  const Offset = 5;
  const OneSecond = 1000;

  beforeAll(async () => {
    // Clean up
    await db.delete(medias);
    await db.delete(mediaSources);

    // Seed source
    await db.insert(mediaSources).values({
      id: mediaSourceId,
      name: "Pagination Source",
      type: "local",
      connectionInfo: { path: "/" },
    });

    // Seed media with specific created dates
    const mediaToInsert: NewMedia[] = Array.from({ length: TotalItems }).map(
      (_, i) => ({
        mediaSourceId,
        filePath: `file_${i}.jpg`,
        fileName: `file_${i}.jpg`,
        mediaType: "image",
        width: 100,
        height: 100,
        createdAt: new Date(Date.now() + i * OneSecond), // Increasing timestamps
      })
    );

    // Insert in batches to avoid conflicts or limits if any
    await db.insert(medias).values(mediaToInsert);
  });

  afterAll(async () => {
    await db.delete(medias);
    await db.delete(mediaSources);
  });

  describe("findAllBySourceId", () => {
    it("should return all items if large limit is specified", async () => {
      // Default limit is 100, so we pass 1000 to get all 105
      const results = await MediaRepository.findAllBySourceId(
        mediaSourceId,
        LargeLimit
      );
      expect(results.length).toBe(TotalItems);
    });

    it("should return items ordered by createdAt DESC", async () => {
      const results = await MediaRepository.findAllBySourceId(
        mediaSourceId,
        LargeLimit
      );
      const first = results[0];
      const last = results.at(-1);
      expect(first.createdAt?.getTime()).toBeGreaterThan(
        last.createdAt?.getTime()
      );
    });

    it("should respect limit if specified", async () => {
      const results = await MediaRepository.findAllBySourceId(
        mediaSourceId,
        PageSize
      );
      expect(results.length).toBe(PageSize);
    });

    it("should respect offset if specified", async () => {
      const all = await MediaRepository.findAllBySourceId(
        mediaSourceId,
        LargeLimit
      );
      const results = await MediaRepository.findAllBySourceId(
        mediaSourceId,
        PageSize,
        Offset
      );

      expect(results.length).toBe(PageSize);
      // Since it's DESC, index 0 is newest.
      // Offset 5 means we skip the first 5 newest.
      expect(results[0].id).toBe(all[Offset].id);
    });
  });

  describe("globalSearchMedia (Optimized)", () => {
    it("should return total count correctly", async () => {
      const { total, media } = await globalSearchMedia({ limit: PageSize });
      expect(total).toBe(TotalItems);
      expect(media.length).toBe(PageSize);
    });

    it("should handle empty results with offset correctly", async () => {
      // Offset beyond total
      const { total, media } = await globalSearchMedia({
        limit: PageSize,
        offset: 200,
      });
      expect(media.length).toBe(0);
      expect(total).toBe(TotalItems); // Should still return total count via fallback query
    });
  });
});
