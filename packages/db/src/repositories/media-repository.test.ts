import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { medias } from "../schema";
import { buildTimestampCondition } from "./media-repository";

const dialect = new PgDialect();

function compileCondition(
	operator: string,
	value: Parameters<typeof buildTimestampCondition>[2],
) {
	const condition = buildTimestampCondition(medias.createdAt, operator, value);
	if (!condition) return null;
	return dialect.sqlToQuery(condition);
}

describe("buildTimestampCondition", () => {
	it("builds a full UTC day range for YYYY-MM-DD without crashing PgDialect serialization", () => {
		const equalsQuery = compileCondition("equals", "2026-11-21");
		expect(equalsQuery).not.toBeNull();
		expect(equalsQuery?.params).toEqual([
			"2026-11-21T00:00:00.000Z",
			"2026-11-22T00:00:00.000Z",
		]);

		const gtQuery = compileCondition("gt", "2026-11-21");
		expect(gtQuery?.params).toEqual(["2026-11-22T00:00:00.000Z"]);

		const gteQuery = compileCondition("gte", "2026-11-21");
		expect(gteQuery?.params).toEqual(["2026-11-21T00:00:00.000Z"]);

		const ltQuery = compileCondition("lt", "2026-11-21");
		expect(ltQuery?.params).toEqual(["2026-11-21T00:00:00.000Z"]);

		const lteQuery = compileCondition("lte", "2026-11-21");
		expect(lteQuery?.params).toEqual(["2026-11-22T00:00:00.000Z"]);
	});

	it("accepts numeric epoch timestamps, ISO strings, and Date objects as ISO timestamp params", () => {
		const numericQuery = compileCondition("gte", 0);
		expect(numericQuery?.params).toEqual(["1970-01-01T00:00:00.000Z"]);

		const isoQuery = compileCondition("equals", "2026-11-21T12:34:56.000Z");
		expect(isoQuery?.params).toEqual(["2026-11-21T12:34:56.000Z"]);

		const dateQuery = compileCondition(
			"lt",
			new Date("2026-11-21T12:34:56.000Z"),
		);
		expect(dateQuery?.params).toEqual(["2026-11-21T12:34:56.000Z"]);
	});

	it("supports in, notIn, isEmpty, and isNotEmpty cleanly", () => {
		const inQuery = compileCondition("in", ["2026-11-20", "2026-11-21"]);
		expect(inQuery?.params).toEqual([
			"2026-11-20T00:00:00.000Z",
			"2026-11-21T00:00:00.000Z",
			"2026-11-21T00:00:00.000Z",
			"2026-11-22T00:00:00.000Z",
		]);

		const emptyQuery = compileCondition("isEmpty", null);
		expect(emptyQuery?.sql).toContain("is null");

		const notEmptyQuery = compileCondition("isNotEmpty", null);
		expect(notEmptyQuery?.sql).toContain("is not null");
	});

	it("returns undefined instead of throwing for invalid dates, empty strings, or unsupported operators", () => {
		expect(compileCondition("equals", "")).toBeNull();
		expect(compileCondition("equals", "2026-02-30")).toBeNull();
		expect(compileCondition("equals", "not-a-date")).toBeNull();
		expect(compileCondition("equals", Number.NaN)).toBeNull();
		expect(compileCondition("contains", "2026-11-21")).toBeNull();
		expect(compileCondition("gt", null)).toBeNull();
		expect(compileCondition("equals", true)).toBeNull();
	});
});
