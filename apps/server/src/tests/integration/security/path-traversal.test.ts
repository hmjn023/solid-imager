import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

const TEST_DIR = path.join(process.cwd(), "test-data-storage-security");
const TARGET_DIR = path.join(TEST_DIR, "target");

// PNG Signature + IHDR chunk (basic valid png structure)
const VALID_PNG_BUFFER = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex"
);

describe("ServerMediaStorage Security", () => {
  beforeAll(async () => {
    await fs.mkdir(TARGET_DIR, { recursive: true });
    // Create a valid image file outside target
    // We need valid image because if path validation passes (or we test edge cases),
    // code proceeds to sharp() which needs valid image.
    // If we test traversal rejection, it should throw BEFORE sharp.

    const validPngBuffer = VALID_PNG_BUFFER;

    await fs.writeFile(path.join(TEST_DIR, "valid.png"), validPngBuffer);
    await fs.writeFile(path.join(TARGET_DIR, "valid.png"), validPngBuffer);

    // Also create a text file for non-image tests if any
    await fs.writeFile(
      path.join(TEST_DIR, "secret.txt"),
      "This should not be accessed"
    );
  });

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  test("getFile should block traversal to parent directory", async () => {
    const traversalPath = "../secret.txt";
    await expect(
      ServerMediaStorage.getFile(TARGET_DIR, traversalPath)
    ).rejects.toThrow("Invalid path");
  });

  test("deleteFile should block traversal", async () => {
    const traversalPath = "../secret.txt";
    await expect(
      ServerMediaStorage.deleteFile(TARGET_DIR, traversalPath)
    ).rejects.toThrow("Invalid path");
    const exists = await fs
      .access(path.join(TEST_DIR, "secret.txt"))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  test("saveFile should block traversal in filename", async () => {
    const validPngBuffer = VALID_PNG_BUFFER;

    const file = new File([validPngBuffer], "test.png", { type: "image/png" });
    const traversalFilename = "../malicious.png";

    // Expect strict rejection
    await expect(
      ServerMediaStorage.saveFile(TARGET_DIR, file, {
        filename: traversalFilename,
      })
    ).rejects.toThrow("Invalid path");
  });

  test("saveFile should NOT silently sanitize via stripping directories (it should fail if dir is missing)", async () => {
    const validPngBuffer = VALID_PNG_BUFFER;
    const file = new File([validPngBuffer], "test.png", { type: "image/png" });
    const deeplyNested = "nested/file.png";

    // Since 'nested' dir does not exist and saveFile does not create it (nor sanitize the path string),
    // file system should throw ENOENT.
    try {
      await ServerMediaStorage.saveFile(TARGET_DIR, file, {
        filename: deeplyNested,
        overwrite: true,
      });
      throw new Error("Should have failed with ENOENT");
    } catch (e: any) {
      if (e.message === "Should have failed with ENOENT") {
        throw e;
      }
      expect(e.code).toBe("ENOENT");
    }
  });

  test("copyFile should block traversal in target filename", async () => {
    const source = path.join(TARGET_DIR, "valid.png");
    const traversalName = "../copied_malicious.png";

    await expect(
      ServerMediaStorage.copyFile(source, TARGET_DIR, {
        filename: traversalName,
      })
    ).rejects.toThrow("Invalid path");
  });
});
