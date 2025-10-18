import { promises as fs } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// Note: These tests require a running server and a pre-existing media source and media item.
// For a real-world scenario, you would use a setup script or fixtures to create this data.

const SOURCE_ID = "... pre-existing-source-id ...";
const MEDIA_ID = "... pre-existing-media-id ...";
const THUMBNAIL_PATH = path.join(".cache/thumbnails", `${MEDIA_ID}.webp`);

test.describe("Thumbnail Endpoint", () => {
  test.beforeEach(async () => {
    // Ensure no thumbnail exists before each test
    try {
      await fs.unlink(THUMBNAIL_PATH);
    } catch (e: any) {
      if (e.code !== "ENOENT") {
        throw e;
      }
    }
  });

  test("should return 404 if media does not exist", async ({ request }) => {
    const fakeMediaId = "00000000-0000-0000-0000-000000000000";
    const response = await request.get(
      `/api/sources/${SOURCE_ID}/media/${fakeMediaId}/thumbnail`
    );
    const NotFound = 404;
    expect(response.status()).toBe(NotFound);
  });

  test("should generate thumbnail on-demand if it does not exist", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/sources/${SOURCE_ID}/media/${MEDIA_ID}/thumbnail`
    );
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toBe("image/webp");

    // Verify the file was created
    const stats = await fs.stat(THUMBNAIL_PATH);
    expect(stats.isFile()).toBeTruthy();
  });

  test("should return existing thumbnail from cache", async ({ request }) => {
    // First, generate the thumbnail
    const initialResponse = await request.get(
      `/api/sources/${SOURCE_ID}/media/${MEDIA_ID}/thumbnail`
    );
    expect(initialResponse.ok()).toBeTruthy();

    // Second, request it again
    const cachedResponse = await request.get(
      `/api/sources/${SOURCE_ID}/media/${MEDIA_ID}/thumbnail`
    );
    expect(cachedResponse.ok()).toBeTruthy();
    expect(cachedResponse.headers()["content-type"]).toBe("image/webp");
  });
});
