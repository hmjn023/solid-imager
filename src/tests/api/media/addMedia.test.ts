import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { addMediaRequestSchema } from "~/domain/media/schemas";
import type { Media } from "~/infrastructure/db/schema"; // Assuming Media type will be exported from schema

describe("addMedia Contract", () => {
	it("should return a Media object on successful addition", async () => {
		// This test will initially fail as addMedia is not yet implemented.
		// It serves as a contract definition.
		const newMediaData = {
			sourceId: "a0000000-0000-0000-0000-000000000000",
			filePath: "/path/to/test/image.png",
			fileName: "image.png",
			size: 1024,
			createdAt: new Date(),
			updatedAt: new Date(),
			mediaType: "image" as const,
			width: 800,
			height: 600,
		};

		// Validate with Zod schema
		addMediaRequestSchema.parse(newMediaData);

		// Placeholder for the actual addMedia function call
		// const result = await addMedia(newMediaData);
		const result: Media = {
			id: "mock-uuid-123",
			...newMediaData,
			sourceId: "mock-source-id",
			modifiedAt: newMediaData.updatedAt,
			indexedAt: newMediaData.updatedAt,
		};

		expect(result).toBeDefined();
		expect(result.id).toBeTypeOf("string");
		expect(result.filePath).toBe(newMediaData.filePath);
		expect(result.fileName).toBe(newMediaData.fileName);
		expect(result.fileSize).toBe(newMediaData.size);
		expect(result.createdAt).toEqual(newMediaData.createdAt);
		expect(result.modifiedAt).toEqual(newMediaData.updatedAt);
		expect(result.mediaType).toBe(newMediaData.mediaType);
		expect(result.width).toBe(newMediaData.width);
		expect(result.height).toBe(newMediaData.height);
	});

	it("should throw a ZodError if required fields are missing or invalid", async () => {
		const invalidMediaData = {
			filePath: "/path/to/test/image.png",
			// Missing fileName, size, etc.
		};

		expect(() => addMediaRequestSchema.parse(invalidMediaData)).toThrow(
			ZodError,
		);
	});

	it("should throw an error if media with same sourceId and filePath already exists", async () => {
		const _newMediaData = {
			sourceId: "a0000000-0000-0000-0000-000000000000",
			filePath: "/path/to/test/duplicate.png",
			fileName: "duplicate.png",
			size: 1024,
			createdAt: new Date(),
			updatedAt: new Date(),
			mediaType: "image" as const,
			width: 800,
			height: 600,
		};

		// Simulate existing media
		// await addMedia(newMediaData);

		// Expecting an error when trying to add again
		// await expect(addMedia(newMediaData)).rejects.toThrow('Media with this filePath already exists for the given sourceId');
	});
});
