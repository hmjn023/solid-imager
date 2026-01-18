import { describe, expect, it } from "vitest";
import { BackupService } from "~/application/services/backup-service";

describe("BackupService (Unit)", () => {
  describe("_transformMediaList", () => {
    it("should transform a media item to the export format", () => {
      const mockMedia = {
        id: "media-id",
        filePath: "path/to/image.jpg",
        fileName: "image.jpg",
        description: "A description",
        width: 1920,
        height: 1080,
        fileSize: 1024,
        mediaType: "image",
        createdAt: new Date("2024-01-01"),
        modifiedAt: new Date("2024-01-01"),
        indexedAt: new Date("2024-01-01"),
        tags: [
          { tag: { name: "Tag 1" }, tagType: "positive", confidence: 0.95 },
        ],
        authors: [{ author: { name: "Author 1", accountId: "acc-1" } }],
        characters: [],
        ips: [],
        projects: [],
        urls: [{ url: "https://example.com/orig.jpg" }],
        generationInfo: null,
      };

      const result = BackupService._transformMediaList([mockMedia]);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "media-id",
        tags: [{ name: "Tag 1", type: "positive", confidence: 0.95 }],
        authors: [{ name: "Author 1", accountId: "acc-1" }],
        sourceUrls: ["https://example.com/orig.jpg"],
      });
    });
  });
});
