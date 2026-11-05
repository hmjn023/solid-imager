import { describe, expect, it } from "vitest";
import { downloadItemSchema, ugoiraMetadataSchema } from "../src/public/media";

describe("ugoira download metadata", () => {
	it("keeps frame order and variable delays across the download contract", () => {
		const ugoira = {
			frames: [
				{ file: "000001.png", delay: 120 },
				{ file: "000000.png", delay: 35 },
			],
		};
		expect(
			downloadItemSchema.parse({
				targetUrl: "https://i.pximg.net/img-zip-ugoira/123.zip",
				ugoira,
			}).ugoira,
		).toEqual(ugoira);
	});
	it.each([
		"../000000.jpg",
		"/000000.jpg",
		"folder/000000.jpg",
		"000000.jpg\nfile secret",
		"000000.svg",
	])("rejects unsafe or unsupported frame name %s", (file) => {
		expect(
			ugoiraMetadataSchema.safeParse({ frames: [{ file, delay: 50 }] }).success,
		).toBe(false);
	});
	it.each([0, -1, 0.5, 60_001, Infinity])(
		"rejects invalid frame delay %s",
		(delay) => {
			expect(
				ugoiraMetadataSchema.safeParse({
					frames: [{ file: "000000.jpg", delay }],
				}).success,
			).toBe(false);
		},
	);
	it("rejects missing or duplicate frames", () => {
		expect(ugoiraMetadataSchema.safeParse({ frames: [] }).success).toBe(false);
		expect(
			ugoiraMetadataSchema.safeParse({
				frames: [
					{ file: "0.jpg", delay: 10 },
					{ file: "0.jpg", delay: 20 },
				],
			}).success,
		).toBe(false);
	});
	it("bounds frame count and total duration", () => {
		expect(
			ugoiraMetadataSchema.safeParse({
				frames: Array.from({ length: 10_001 }, (_, i) => ({
					file: `${i}.jpg`,
					delay: 1,
				})),
			}).success,
		).toBe(false);
		expect(
			ugoiraMetadataSchema.safeParse({
				frames: Array.from({ length: 61 }, (_, i) => ({
					file: `${i}.jpg`,
					delay: 60_000,
				})),
			}).success,
		).toBe(false);
	});
});
