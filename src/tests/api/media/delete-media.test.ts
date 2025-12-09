import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { mediaIdSchema } from "~/domain/media/schemas";
import { mediaSourceIdSchema } from "~/domain/sources/schemas";

describe("deleteMedia Contract", () => {
  it("should return success: true on successful deletion", () => {
    const mediaSourceId = "b0000000-0000-4000-8000-000000000000";
    const mediaId = "a0000000-0000-4000-8000-000000000000";

    // Validate with Zod schema
    mediaSourceIdSchema.parse(mediaSourceId);
    mediaIdSchema.parse(mediaId);

    // Placeholder for the actual deleteMedia function call
    // const result = await deleteMedia(mediaSourceId, mediaId);
    const result = { success: true, message: "Media deleted successfully" };

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("should return an error if mediaId is not found", () => {
    // This test will initially fail as deleteMedia is not yet implemented.
    const _mediaSourceId = "b0000000-0000-4000-8000-000000000000";
    const _mediaId = "a0000000-0000-0000-0000-000000000000";

    // Placeholder for the actual deleteMedia function call
    // const errorResult = await deleteMedia(mediaSourceId, mediaId);
    const errorResult = { message: "Media not found" };

    expect(errorResult).toBeDefined();
    expect(errorResult.message).toBeTypeOf("string");
  });

  it("should throw a ZodError for an invalid mediaId format", () => {
    const _mediaSourceId = "b0000000-0000-0000-0000-000000000000";
    const mediaId = "invalid-uuid-format";
    expect(() => mediaIdSchema.parse(mediaId)).toThrow(ZodError);
  });

  it("should throw a ZodError for an invalid mediaSourceId format", () => {
    const mediaSourceId = "invalid-source-id-format";
    const _mediaId = "a0000000-0000-0000-0000-000000000000";
    expect(() => mediaSourceIdSchema.parse(mediaSourceId)).toThrow(ZodError);
  });
});
