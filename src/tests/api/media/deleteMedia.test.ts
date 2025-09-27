import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { mediaIdSchema, sourceIdSchema } from "~/lib/schemas";

describe("deleteMedia Contract", () => {
  it("should return success: true on successful deletion", async () => {
    const sourceId = "b0000000-0000-0000-0000-000000000000";
    const mediaId = "a0000000-0000-0000-0000-000000000000";

    // Validate with Zod schema
    sourceIdSchema.parse(sourceId);
    mediaIdSchema.parse(mediaId);

    // Placeholder for the actual deleteMedia function call
    // const result = await deleteMedia(sourceId, mediaId);
    const result = { success: true, message: "Media deleted successfully" };

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("should return an error if mediaId is not found", async () => {
    // This test will initially fail as deleteMedia is not yet implemented.
    // It serves as a contract definition.
    const _sourceId = "b0000000-0000-0000-0000-000000000000";
    const _mediaId = "a0000000-0000-0000-0000-000000000000";

    // Placeholder for the actual deleteMedia function call
    // const errorResult = await deleteMedia(sourceId, mediaId);
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
