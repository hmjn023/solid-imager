import { describe, expect, it } from "vitest";
import {
	addMediaRequestSchema,
	directoryPathSchema,
	mediaIdSchema,
	updateMediaRequestSchema,
} from "../src/domain/media/schemas";
import { mediaSourceIdSchema } from "../src/domain/sources/schemas";

const mediaSourceId = "b0000000-0000-4000-8000-000000000000";
const mediaId = "a0000000-0000-4000-8000-000000000000";

// Input validation belongs to the domain. CRUD behavior is exercised by the
// server's integration/media suite, not by constructing responses in a test.
describe("media input validation", () => {
	it("accepts valid media and source identifiers", () => {
		expect(mediaIdSchema.parse(mediaId)).toBe(mediaId);
		expect(mediaSourceIdSchema.parse(mediaSourceId)).toBe(mediaSourceId);
	});
	it("rejects an invalid media identifier", () => {
		expect(mediaIdSchema.safeParse("invalid-uuid-format").success).toBe(false);
	});
	it("rejects an invalid source identifier", () => {
		expect(
			mediaSourceIdSchema.safeParse("invalid-source-id-format").success,
		).toBe(false);
	});
	it("accepts a non-empty directory path", () => {
		expect(directoryPathSchema.parse("/media/images")).toBe("/media/images");
	});
	it("rejects an empty directory path", () => {
		expect(directoryPathSchema.safeParse("").success).toBe(false);
	});
	it("accepts media registration input", () => {
		const input = {
			mediaSourceId,
			filePath: "/media/image.png",
			fileName: "image.png",
			fileSize: 1024,
			description: null,
			mediaType: "image",
			width: 800,
			height: 600,
		};
		expect(addMediaRequestSchema.parse(input)).toMatchObject(input);
	});
	it("rejects registration with missing required fields", () => {
		expect(
			addMediaRequestSchema.safeParse({ filePath: "/media/image.png" }).success,
		).toBe(false);
	});
	it("accepts a partial media update", () => {
		const update = { description: "Updated description", width: 1024 };
		expect(updateMediaRequestSchema.parse(update)).toEqual(update);
	});
	it("rejects a negative image width", () => {
		expect(updateMediaRequestSchema.safeParse({ width: -100 }).success).toBe(
			false,
		);
	});
});
