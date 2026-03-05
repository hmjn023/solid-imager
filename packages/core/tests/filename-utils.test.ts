import { describe, it, expect } from "vitest";
import { generateMediaFilename, sanitizeFilenamePart, extractIdFromUrl } from "../src/domain/media/utils/filename-utils";
import type { DownloadItem } from "../src/domain/media/schemas";

describe("filename-utils", () => {
  describe("sanitizeFilenamePart", () => {
    it("should remove @ from the beginning", () => {
      expect(sanitizeFilenamePart("@user_name")).toBe("user_name");
    });

    it("should remove invalid characters", () => {
      expect(sanitizeFilenamePart("user/name?%")).toBe("username");
    });

    it("should replace spaces with underscores", () => {
      expect(sanitizeFilenamePart("user name")).toBe("user_name");
    });
  });

  describe("extractIdFromUrl", () => {
    it("should extract Twitter status ID", () => {
      expect(extractIdFromUrl("https://twitter.com/user/status/123456789?s=20")).toBe("123456789");
      expect(extractIdFromUrl("https://x.com/user/status/987654321")).toBe("987654321");
    });

    it("should extract Danbooru post ID", () => {
      expect(extractIdFromUrl("https://danbooru.donmai.us/posts/123456")).toBe("123456");
    });

    it("should return null for other URLs", () => {
      expect(extractIdFromUrl("https://google.com")).toBeNull();
    });
  });

  describe("generateMediaFilename", () => {
    it("should generate unified filename with author, date, and ID", () => {
      const item: DownloadItem = {
        targetUrl: "https://pbs.twimg.com/media/abc.jpg",
        authors: [{ name: "Artist", accountId: "@artist_id" }],
        createdAt: "2023-10-27T10:00:00Z",
        sourceUrls: ["https://twitter.com/artist_id/status/1717891234"]
      };
      expect(generateMediaFilename(item, ".jpg")).toBe("artist_id_20231027_1717891234.jpg");
    });

    it("should fallback to name if accountId is missing", () => {
      const item: DownloadItem = {
        targetUrl: "https://pbs.twimg.com/media/abc.jpg",
        authors: [{ name: "Artist Name" }],
        createdAt: "2023-10-27T10:00:00Z",
        sourceUrls: ["https://twitter.com/artist_id/status/1717891234"]
      };
      expect(generateMediaFilename(item, ".jpg")).toBe("Artist_Name_20231027_1717891234.jpg");
    });

    it("should handle missing date", () => {
      const item: DownloadItem = {
        targetUrl: "https://pbs.twimg.com/media/abc.jpg",
        authors: [{ name: "Artist" }],
        sourceUrls: ["https://danbooru.donmai.us/posts/123456"]
      };
      expect(generateMediaFilename(item, ".png")).toBe("Artist_123456.png");
    });

    it("should handle missing author", () => {
      const item: DownloadItem = {
        targetUrl: "https://pbs.twimg.com/media/abc.jpg",
        createdAt: "2023-10-27T10:00:00Z",
        sourceUrls: ["https://danbooru.donmai.us/posts/123456"]
      };
      expect(generateMediaFilename(item, ".png")).toBe("20231027_123456.png");
    });
  });
});
