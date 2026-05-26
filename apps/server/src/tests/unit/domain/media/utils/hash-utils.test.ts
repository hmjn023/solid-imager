import { createHash } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HashUtils } from "@solid-imager/application";
import { describe, expect, it } from "vite-plus/test";

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
