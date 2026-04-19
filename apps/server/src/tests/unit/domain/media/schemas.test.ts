import { downloadItemSchema } from "@solid-imager/core/domain/media/schemas";
import { describe, expect, it } from "vite-plus/test";

describe("downloadItemSchema", () => {
	it("should validate a valid download item", () => {
		const validItem = {
			targetUrl: "https://example.com/image.jpg",
			sourceUrls: ["https://example.com/tweet", "https://example.com/image.jpg"],
			description: "Test description",
			authors: [{ name: "Test Author", accountId: "@test" }],
			tags: [{ name: "tag1", type: "positive" }],
			cookies: [{ name: "session", value: "123" }],
			userAgent: "Mozilla/5.0",
		};

		const result = downloadItemSchema.safeParse(validItem);
		expect(result.success).toBe(true);
	});

	it("should allow missing targetUrl (for restore scenarios)", () => {
		const backupItem = {
			sourceUrls: ["https://example.com/tweet"],
			filePath: "images/123.jpg",
		};

		const result = downloadItemSchema.safeParse(backupItem);
		expect(result.success).toBe(true);
	});

	it("should fail if targetUrl is not a valid URL", () => {
		const invalidItem = {
			targetUrl: "not-a-url",
		};

		const result = downloadItemSchema.safeParse(invalidItem);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toContain("Invalid target URL");
		}
	});

	it("should validate optional fields", () => {
		const minimalItem = {
			targetUrl: "https://example.com/image.png",
		};
		const result = downloadItemSchema.safeParse(minimalItem);
		expect(result.success).toBe(true);
	});
});
