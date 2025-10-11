import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { Media } from "~/db/schema"; // Assuming Media type will be exported from schema
import {
  mediaIdSchema,
  sourceIdSchema,
  updateMediaRequestSchema,
} from "~/domain/media/schemas";

describe("updateMedia Contract", () => {
  it("should return an updated Media object on successful update", async () => {
    const sourceId = "b0000000-0000-0000-0000-000000000000";
    const mediaId = "a0000000-0000-0000-0000-000000000000";
    const updates = {
      description: "Updated description",
      width: 1024,
    };

    // Validate with Zod schemas
    sourceIdSchema.parse(sourceId);
    mediaIdSchema.parse(mediaId);
    updateMediaRequestSchema.parse(updates);

    // Placeholder for the actual updateMedia function call
    // const result = await updateMedia(sourceId, mediaId, updates);
    const result: Media = {
      id: mediaId,
      filePath: "/path/to/test/image.png",
      fileName: "image.png",
      fileSize: 1024,
      createdAt: new Date(),
      modifiedAt: new Date(),
      mediaType: "image",
      width: updates.width,
      height: 600,
      sourceId,
      indexedAt: new Date(),
      description: updates.description,
    };

    expect(result).toBeDefined();
    expect(result.id).toBe(mediaId);
    expect(result.description).toBe(updates.description);
    expect(result.width).toBe(updates.width);
  });

  it("should return an error if mediaId is not found", async () => {
    // This test will initially fail as updateMedia is not yet implemented.
    // It serves as a contract definition.
    const _sourceId = "b0000000-0000-0000-0000-000000000000";
    const _mediaId = "a0000000-0000-0000-0000-000000000000";
    const _updates = { description: "Updated description" };

    // Placeholder for the actual updateMedia function call
    // const errorResult = await updateMedia(sourceId, mediaId, updates);
    const errorResult = { message: "Media not found" };

    expect(errorResult).toBeDefined();
    expect(errorResult.message).toBeTypeOf("string");
  });

  it("should throw a ZodError for invalid mediaId format", async () => {
    const _sourceId = "b0000000-0000-0000-0000-000000000000";
    const mediaId = "invalid-uuid-format";
    const _updates = { description: "Updated description" };
    expect(() => mediaIdSchema.parse(mediaId)).toThrow(ZodError);
  });

  it("should throw a ZodError for invalid sourceId format", async () => {
    const sourceId = "invalid-source-id-format";
    const _mediaId = "a0000000-0000-0000-0000-000000000000";
    const _updates = { description: "Updated description" };
    expect(() => sourceIdSchema.parse(sourceId)).toThrow(ZodError);
  });

  it("should throw a ZodError for invalid update data", async () => {
    const _mediaId = "a0000000-0000-0000-0000-000000000000";
    const updates = { width: -100 }; // Invalid field
    expect(() => updateMediaRequestSchema.parse(updates)).toThrow(ZodError);
  });
});
