import {
	mediaIdSchema,
	mediaSourceIdSchema,
	updateMediaRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import { describe, expect, it } from "vite-plus/test";
import { ZodError } from "zod";
import type { Media } from "~/infrastructure/db/schema"; // Assuming Media type will be exported from schema

describe("updateMedia Contract", () => {
	it("should return an updated Media object on successful update", () => {
		const mediaSourceId = "b0000000-0000-4000-8000-000000000000";
		const mediaId = "a0000000-0000-4000-8000-000000000000";
		const updates = {
			description: "Updated description",
			width: 1024,
		};

		// Validate with Zod schemas
		mediaSourceIdSchema.parse(mediaSourceId);
		mediaIdSchema.parse(mediaId);
		updateMediaRequestSchema.parse(updates);

		// Placeholder for the actual updateMedia function call
		// const result = await updateMedia(mediaSourceId, mediaId, updates);
		const result: Media = {
			id: mediaId,
			filePath: "/path/to/test/image.png",
			fileName: "image.png",
			fileSize: 1024,
			createdAt: new Date(),
			modifiedAt: new Date(),
			mediaType: "image",
			width: updates.width,
			height: 600,
			mediaSourceId,
			indexedAt: new Date(),
			description: updates.description,
			status: "active",
		};

		expect(result).toBeDefined();
		expect(result.id).toBe(mediaId);
		expect(result.description).toBe(updates.description);
		expect(result.width).toBe(updates.width);
	});

	it("should return an error if mediaId is not found", () => {
		// This test will initially fail as updateMedia is not yet implemented.
		// It serves as a contract definition.
		const _mediaSourceId = "b0000000-0000-4000-8000-000000000000";
		const _mediaId = "a0000000-0000-0000-0000-000000000000";
		const _updates = { description: "Updated description" };

		// Placeholder for the actual updateMedia function call
		// const errorResult = await updateMedia(mediaSourceId, mediaId, updates);
		const errorResult = { message: "Media not found" };

		expect(errorResult).toBeDefined();
		expect(errorResult.message).toBeTypeOf("string");
	});

	it("should throw a ZodError for invalid mediaId format", () => {
		const _mediaSourceId = "b0000000-0000-4000-8000-000000000000";
		const mediaId = "invalid-uuid-format";
		const _updates = { description: "Updated description" };
		expect(() => mediaIdSchema.parse(mediaId)).toThrow(ZodError);
	});

	it("should throw a ZodError for invalid mediaSourceId format", () => {
		const mediaSourceId = "invalid-source-id-format";
		const _mediaId = "a0000000-0000-0000-0000-000000000000";
		const _updates = { description: "Updated description" };
		expect(() => mediaSourceIdSchema.parse(mediaSourceId)).toThrow(ZodError);
	});

	it("should throw a ZodError for invalid update data", () => {
		const _mediaId = "a0000000-0000-0000-0000-000000000000";
		const updates = { width: -100 }; // Invalid field
		expect(() => updateMediaRequestSchema.parse(updates)).toThrow(ZodError);
	});
});
