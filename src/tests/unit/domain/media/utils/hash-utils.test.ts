import { describe, it, expect } from "vitest";
import { HashUtils } from "~/domain/media/utils/hash-utils";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

describe("HashUtils", () => {
  describe("generateMd5", () => {
    it("should generate correct MD5 hash for a file", async () => {
      const content = "Hello, World!";
      const tempFilePath = join(tmpdir(), `test-hash-${Date.now()}.txt`);

      // Expected hash using crypto directly
      const expectedHash = createHash("md5").update(content).digest("hex");

      try {
        writeFileSync(tempFilePath, content);
        const hash = await HashUtils.generateMd5(tempFilePath);
        expect(hash).toBe(expectedHash);
      } finally {
        try {
          unlinkSync(tempFilePath);
        } catch {
          // Ignore error if file doesn't exist
        }
      }
    });

    it("should throw an error if file does not exist", async () => {
      const nonExistentPath = join(tmpdir(), "non-existent-file.txt");
      await expect(HashUtils.generateMd5(nonExistentPath)).rejects.toThrow();
    });
  });
});
