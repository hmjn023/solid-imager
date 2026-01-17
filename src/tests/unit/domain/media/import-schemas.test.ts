import { describe, expect, it } from "vitest";
import {
  bulkImportRequestSchema,
  importItemSchema,
} from "~/domain/media/import-schemas";

describe("Import Schemas", () => {
  describe("importItemSchema", () => {
    it("should validate a valid import item with minimum fields", () => {
      const validItem = {
        imageUrl: "https://example.com/image.jpg",
      };
      const result = importItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it("should validate a valid import item with all fields", () => {
      const validItem = {
        imageUrl: "https://example.com/image.jpg",
        sourceUrl: "https://twitter.com/user/status/123",
        description: "Test description",
        timestamp: "2024-01-01T00:00:00Z",
        author: {
          name: "Author Name",
          accountId: "author_id",
        },
        tags: [
          { name: "tag1", type: "positive" },
          { name: "tag2", type: "negative", confidence: 0.9 },
        ],
      };
      const result = importItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it("should fail if imageUrl is missing", () => {
      const invalidItem = {
        sourceUrl: "https://twitter.com/user/status/123",
      };
      const result = importItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it("should fail if tags have invalid type", () => {
      const invalidItem = {
        imageUrl: "https://example.com/image.jpg",
        tags: [{ name: "tag1", type: "invalid" }],
      };
      const result = importItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });
  });

  describe("bulkImportRequestSchema", () => {
    it("should validate a valid bulk import request", () => {
      const validRequest = {
        items: [
          { imageUrl: "https://example.com/1.jpg" },
          { imageUrl: "https://example.com/2.jpg" },
        ],
      };
      const result = bulkImportRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("should fail if items are empty", () => {
      const invalidRequest = {
        items: [],
      };
      const result = bulkImportRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });
});
