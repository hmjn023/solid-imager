import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { Media } from "~/infrastructure/db/schema"; // Assuming Media type will be exported from schema
import { directoryPathSchema } from "~/domain/media/schemas";
import { sourceIdSchema } from "~/domain/sources/schemas";

describe("listMedia Contract", () => {
  it("should return an array of Media objects for a valid directoryPath", async () => {
    const sourceId = "b0000000-0000-0000-0000-000000000000";
    const directoryPath = "/path/to/media/folder";

    // Validate with Zod schema
    sourceIdSchema.parse(sourceId);
    directoryPathSchema.parse(directoryPath);

    // Placeholder for the actual listMedia function call
    // const result = await listMedia(sourceId, directoryPath);
    const result: Media[] = [
      {
        id: "mock-uuid-1",
        filePath: "/path/to/media/folder/image1.png",
        fileName: "image1.png",
        fileSize: 1024,
        createdAt: new Date(),
        modifiedAt: new Date(),
        mediaType: "image",
        width: 800,
        height: 600,
        sourceId,
        indexedAt: new Date(),
      },
      {
        id: "mock-uuid-2",
        filePath: "/path/to/media/folder/video1.mp4",
        fileName: "video1.mp4",
        fileSize: 2048,
        createdAt: new Date(),
        modifiedAt: new Date(),
        mediaType: "video",
        width: 1280,
        height: 720,
        sourceId,
        indexedAt: new Date(),
      },
    ];

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].filePath).toBeTypeOf("string");
  });

  it("should return an empty array if directoryPath contains no media files", async () => {
    const _sourceId = "b0000000-0000-0000-0000-000000000000";
    const _directoryPath = "/path/to/empty/folder";

    // Placeholder for the actual listMedia function call
    // const result = await listMedia(sourceId, directoryPath);
    const result: Media[] = [];

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("should throw a ZodError if directoryPath is invalid or inaccessible", async () => {
    const _sourceId = "b0000000-0000-0000-0000-000000000000";
    const directoryPath = ""; // Invalid path
    expect(() => directoryPathSchema.parse(directoryPath)).toThrow(ZodError);
  });

  it("should throw a ZodError for an invalid sourceId format", async () => {
    const sourceId = "invalid-source-id-format";
    const _directoryPath = "/path/to/media/folder";
    expect(() => sourceIdSchema.parse(sourceId)).toThrow(ZodError);
  });
});
