import { describe, expect, it } from "vitest";
import { clampMediaPan } from "./media-viewer-pan";

describe("clampMediaPan", () => {
	it("keeps a fitted image centered at the minimum zoom", () => {
		expect(
			clampMediaPan(
				{ x: 100, y: -100 },
				1,
				{ width: 800, height: 600 },
				{ width: 1600, height: 800 },
			),
		).toEqual({ x: 0, y: 0 });
	});

	it("clamps the actual fitted image rather than its object-contain element", () => {
		expect(
			clampMediaPan(
				{ x: 1000, y: -1000 },
				2,
				{ width: 800, height: 600 },
				{ width: 1600, height: 800 },
			),
		).toEqual({ x: 400, y: -100 });
	});

	it("keeps the narrow axis centered until it exceeds the viewport", () => {
		expect(
			clampMediaPan(
				{ x: 500, y: 500 },
				2,
				{ width: 800, height: 600 },
				{ width: 400, height: 800 },
			),
		).toEqual({ x: 0, y: 300 });
	});

	it("uses the viewport while intrinsic image dimensions are unavailable", () => {
		expect(
			clampMediaPan({ x: -500, y: 20 }, 2, { width: 300, height: 200 }),
		).toEqual({ x: -150, y: 20 });
	});
});
