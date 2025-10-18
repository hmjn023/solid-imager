import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { addMedia, deleteMedia } from "~/infrastructure/api-clients/media";

describe("File System Access Denied Integration", () => {
  const testSourceId = "b0000000-0000-0000-0000-000000000000";

  it("should throw an error when addMedia encounters file system access denied", async () => {
    const newMediaData = {
      sourceId: testSourceId,
      filePath: "/no-access/path/image.png",
      fileName: "image.png",
      size: 1024,
      mediaType: "image" as const,
      width: 800,
      height: 600,
    };

    const exit = await Effect.runPromiseExit(addMedia(newMediaData));
    expect(exit._tag).toBe("Failure");
  });

  it("should throw an error when deleteMedia encounters file system access denied", async () => {
    const mediaId = "mock-uuid-for-denied-access";

    const exit = await Effect.runPromiseExit(
      deleteMedia(testSourceId, mediaId)
    );
    expect(exit._tag).toBe("Failure");
  });
});
