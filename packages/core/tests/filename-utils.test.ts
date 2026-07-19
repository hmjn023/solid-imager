import { describe, expect, it } from "vite-plus/test";
import {
  extractIdFromUrl,
  generateMediaFilename,
  sanitizeFilenamePart,
} from "../src/domain/media/utils/filename-utils";
import type { DownloadItem } from "../src/domain/media/schemas";

describe("filename-utils", () => {
  describe("sanitizeFilenamePart", () => {
    it("should remove @ from the beginning", () => {
      expect(sanitizeFilenamePart("@user_name")).toBe("user_name");
    });

    it("should remove invalid characters including dots", () => {
      expect(sanitizeFilenamePart("user/name.ext?%")).toBe("usernameext");
    });

    it("should replace spaces with underscores", () => {
      expect(sanitizeFilenamePart("user name")).toBe("user_name");
    });

    it("should trim leading and trailing spaces", () => {
      expect(sanitizeFilenamePart("  artist_name  ")).toBe("artist_name");
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

    it("should extract pixivFANBOX post ID", () => {
      expect(extractIdFromUrl("https://example-creator.fanbox.cc/posts/12345678")).toBe("12345678");
    });

    it("should return null for other URLs", () => {
      expect(extractIdFromUrl("https://google.com")).toBeNull();
    });
  });

  describe("generateMediaFilename", () => {
    it("should generate a Twitter filename", () => {
      const item: DownloadItem = {
        targetUrl: "https://pbs.twimg.com/media/abc.jpg",
        authors: [
          {
            name: "Artist",
            accountId: "@artist_id",
            platform: "twitter",
          },
        ],
        sourceUrls: ["https://twitter.com/artist_id/status/1717891234"],
      };
      expect(generateMediaFilename(item, ".jpg")).toBe("artist_id_twitter_1717891234_abc.jpg");
    });

    it("should generate a pixivFANBOX filename", () => {
      const item: DownloadItem = {
        targetUrl: "https://downloads.fanbox.cc/images/post/12345678/exampleAssetId.jpeg",
        authors: [
          {
            name: "Example Creator",
            accountId: "example-creator",
            platform: "pixiv-fanbox",
          },
        ],
        sourceUrls: [
          "https://downloads.fanbox.cc/images/post/12345678/exampleAssetId.jpeg",
          "https://example-creator.fanbox.cc/posts/12345678",
        ],
      };
      expect(generateMediaFilename(item, ".jpeg")).toBe(
        "example-creator_pixiv-fanbox_12345678_exampleAssetId.jpeg",
      );
    });

    it("should infer platform for legacy metadata", () => {
      const item: DownloadItem = {
        targetUrl: "https://cdn.donmai.us/original/hash.png",
        authors: [{ name: "Artist" }],
        sourceUrls: ["https://danbooru.donmai.us/posts/123456"],
      };
      expect(generateMediaFilename(item, ".png")).toBe("Artist_danbooru_123456_hash.png");
    });

    it("should not have a trailing dot if extension is empty", () => {
      const item: DownloadItem = {
        targetUrl: "https://example.com/image",
        authors: [{ name: "Artist" }],
      };
      expect(generateMediaFilename(item, "")).toBe("Artist_image");
    });
  });
});
