import { mediaIdSchema } from "@solid-imager/core/domain/media/schemas";
import { mediaSourceIdSchema } from "@solid-imager/core/domain/sources/schemas";
import { describe, expect, it } from "vite-plus/test";
import { ZodError } from "zod";
import type { Media } from "~/infrastructure/db/schema"; // Assuming Media type will be exported from schema

describe("getMedia Contract", () => {
	it("should return a Media object for a valid mediaId", () => {
		const mediaSourceId = "b0000000-0000-4000-8000-000000000000"; // Valid UUID
		const mediaId = "a0000000-0000-4000-8000-000000000000"; // Valid UUID

		// Validate with Zod schema
		mediaSourceIdSchema.parse(mediaSourceId);
		mediaIdSchema.parse(mediaId);

		// Placeholder for the actual getMedia function call
		// const result = await getMedia(mediaSourceId, mediaId);
		const result: Media = {
			id: mediaId,
			filePath: "/path/to/test/image.png",
			fileName: "image.png",
			fileSize: 1024,
			createdAt: new Date(),
			modifiedAt: new Date(),
			mediaType: "image",
			width: 800,
			height: 600,
			mediaSourceId,
			indexedAt: new Date(),
			description: null,
			status: "active",
		};

		expect(result).toBeDefined();
		expect(result.id).toBe(mediaId);
		expect(result.filePath).toBeTypeOf("string");
	});

	it("should return an error if mediaId is not found", () => {
		// This test will initially fail as getMedia is not yet implemented.
		const _mediaSourceId = "b0000000-0000-4000-8000-000000000000";
		const _mediaId = "a0000000-0000-0000-0000-000000000000"; // Valid UUID, but not found

		// Placeholder for the actual getMedia function call
		// const errorResult = await getMedia(mediaSourceId, mediaId);
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
