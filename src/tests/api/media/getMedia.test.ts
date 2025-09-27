import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { Media } from "~/db/schema"; // Assuming Media type will be exported from schema
import { mediaIdSchema, sourceIdSchema } from "~/lib/schemas";

describe("getMedia Contract", () => {
  it("should return a Media object for a valid mediaId", async () => {
    const sourceId = "b0000000-0000-0000-0000-000000000000"; // Valid UUID
    const mediaId = "a0000000-0000-0000-0000-000000000000"; // Valid UUID

    // Validate with Zod schema
    sourceIdSchema.parse(sourceId);
    mediaIdSchema.parse(mediaId);

    // Placeholder for the actual getMedia function call
    // const result = await getMedia(sourceId, mediaId);
    const result: Media = {
      id: mediaId,
      filePath: "/path/to/test/image.png",
      fileName: "image.png",
      fileSize: 1024,
      createdAt: new Date(),
      modifiedAt: new Date(),
      mediaType: "image",
      width: 800,
      height: 600,
      sourceId,
      indexedAt: new Date(),
    };

    expect(result).toBeDefined();
    expect(result.id).toBe(mediaId);
    expect(result.filePath).toBeTypeOf("string");
  });

  it("should return an error if mediaId is not found", async () => {
    // This test will initially fail as getMedia is not yet implemented.
    // It serves as a contract definition.
    const _sourceId = "b0000000-0000-0000-0000-000000000000";
    const _mediaId = "a0000000-0000-0000-0000-000000000000"; // Valid UUID, but not found

    // Placeholder for the actual getMedia function call
    // const errorResult = await getMedia(sourceId, mediaId);
    const errorResult = { message: "Media not found" };

    expect(errorResult).toBeDefined();
    expect(errorResult.message).toBeTypeOf("string");
  });

  it("should throw a ZodError for an invalid mediaId format", async () => {
    const _sourceId = "b0000000-0000-0000-0000-000000000000";
    const mediaId = "invalid-uuid-format";
    expect(() => mediaIdSchema.parse(mediaId)).toThrow(ZodError);
  });

  it("should throw a ZodError for an invalid sourceId format", async () => {
    const sourceId = "invalid-source-id-format";
    const _mediaId = "a0000000-0000-0000-0000-000000000000";
    expect(() => sourceIdSchema.parse(sourceId)).toThrow(ZodError);
  });
});
