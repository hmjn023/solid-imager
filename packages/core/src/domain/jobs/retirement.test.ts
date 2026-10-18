import { describe, expect, it } from "vitest";
import {
	assessJobObservation,
	jobObservationSchema,
	jobActivitySampleSchema,
	retiredGenericJobTypes,
} from "./retirement";
const baseline = jobActivitySampleSchema.parse({
	sampledAt: "2026-01-01T00:00:00Z",
	database: "fixture",
	databaseOid: "1",
	tableOid: "2",
	serverStartedAt: "2025-12-01T00:00:00Z",
	statsResetAt: null,
	trackCounts: true,
	scans: 10,
	inserted: 3,
	updated: 0,
	deleted: 3,
});
const observation = () =>
	jobObservationSchema.parse({
		version: 1,
		baseline,
		last: baseline,
		observationUntil: "2026-01-08T00:00:00Z",
		rollbackUntil: "2026-01-15T00:00:00Z",
		backupReference: "fixture-backup",
		passed: false,
		violations: [],
	});
describe("generic jobs observation gate", () => {
	it("classifies every known migration type exactly once", () => {
		expect(retiredGenericJobTypes).toHaveLength(16);
		expect(new Set(retiredGenericJobTypes).size).toBe(16);
	});
	it("requires both the observation and rollback deadlines", () => {
		expect(
			assessJobObservation(observation(), {
				...baseline,
				sampledAt: new Date("2026-01-10"),
			}).passed,
		).toBe(false);
		expect(
			assessJobObservation(observation(), {
				...baseline,
				sampledAt: new Date("2026-01-15"),
			}).passed,
		).toBe(true);
	});
	it.each(["scans", "inserted", "updated", "deleted"] as const)(
		"invalidates any %s activity",
		(key) => {
			expect(
				assessJobObservation(observation(), {
					...baseline,
					sampledAt: new Date("2026-02-01"),
					[key]: baseline[key] + 1,
				}).violations,
			).toContain("jobs_activity:" + key);
		},
	);
	it("cannot clear a failed observation by later sampling a lower counter", () => {
		const failed = assessJobObservation(observation(), {
			...baseline,
			sampledAt: new Date("2026-01-03"),
			scans: 11,
		});
		expect(
			assessJobObservation(failed, {
				...baseline,
				sampledAt: new Date("2026-02-01"),
			}).passed,
		).toBe(false);
	});
	it("invalidates restarts, reset epochs, table recreation and time reversal", () => {
		for (const change of [
			{ serverStartedAt: new Date("2026-01-02") },
			{ statsResetAt: new Date("2026-01-02") },
			{ tableOid: "3" },
			{ sampledAt: new Date("2025-12-31") },
		])
			expect(
				assessJobObservation(observation(), {
					...baseline,
					sampledAt: new Date("2026-02-01"),
					...change,
				}).passed,
			).toBe(false);
	});
	it("fails closed when statistics collection is unavailable", () => {
		expect(
			jobActivitySampleSchema.safeParse({ ...baseline, trackCounts: false })
				.success,
		).toBe(false);
	});
});
