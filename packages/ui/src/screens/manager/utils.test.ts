import { describe, expect, it } from "vitest";
import { formatDate } from "./utils";

describe("formatDate", () => {
	it("falls back for invalid date values", () => {
		expect(formatDate("not-a-date")).toBe("—");
		expect(formatDate(new Date(Number.NaN))).toBe("—");
	});
});
