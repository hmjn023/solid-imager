import { describe, expect, it } from "vite-plus/test";
import { validateFileSignature } from "~/application/services/media-service";

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a0000000d", "hex");
const INVALID_ZEROS = Buffer.from("00000000", "hex");
const EXE_SIGNATURE = Buffer.from("4d5a", "hex"); // MZ

const WEBP_SIGNATURE = Buffer.from("524946460000000057454250565038", "hex"); // RIFF...WEBPVP8

describe("validateFileSignature", () => {
	it("should accept valid PNG", async () => {
		const file = new File([PNG_SIGNATURE], "test.png", { type: "image/png" });
		await expect(validateFileSignature(file, "test.png")).resolves.toBeUndefined();
	});

	it("should reject PNG with invalid signature", async () => {
		const file = new File([INVALID_ZEROS], "test.png", { type: "image/png" });
		await expect(validateFileSignature(file, "test.png")).rejects.toThrow(
			"File signature mismatch",
		);
	});

	it("should reject mismatched extension (e.g. exe renamed to png)", async () => {
		const file = new File([EXE_SIGNATURE], "malware.png", {
			type: "image/png",
		});
		await expect(validateFileSignature(file, "malware.png")).rejects.toThrow(
			"File signature mismatch",
		);
	});

	it("should accept valid WEBP", async () => {
		// We construct a mock WEBP file buffer
		const file = new File([WEBP_SIGNATURE], "test.webp", {
			type: "image/webp",
		});
		await expect(validateFileSignature(file, "test.webp")).resolves.toBeUndefined();
	});
});
