import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
import { describe, expect, it } from "vitest";
import {
	getRetryableJobIds,
	toggleAllJobSelection,
	toggleJobSelection,
} from "./v2-jobs-selection";

const jobs: Pick<JobDto, "id" | "status">[] = [
	{
		id: "00000000-0000-4000-8000-000000000001",
		status: "failed",
	},
	{
		id: "00000000-0000-4000-8000-000000000002",
		status: "completed",
	},
	{
		id: "00000000-0000-4000-8000-000000000003",
		status: "failed",
	},
];

describe("job selection helpers", () => {
	it("returns only failed job ids", () => {
		expect(getRetryableJobIds(jobs)).toEqual([
			"00000000-0000-4000-8000-000000000001",
			"00000000-0000-4000-8000-000000000003",
		]);
	});

	it("toggles an individual job", () => {
		const selected = new Set(["00000000-0000-4000-8000-000000000001"]);

		expect(
			toggleJobSelection(selected, "00000000-0000-4000-8000-000000000003"),
		).toEqual(
			new Set([
				"00000000-0000-4000-8000-000000000001",
				"00000000-0000-4000-8000-000000000003",
			]),
		);
		expect(
			toggleJobSelection(selected, "00000000-0000-4000-8000-000000000001"),
		).toEqual(new Set());
	});

	it("selects all retryable jobs and clears them on the next toggle", () => {
		const retryableJobIds = getRetryableJobIds(jobs);
		const selected = toggleAllJobSelection(new Set(), retryableJobIds);

		expect(selected).toEqual(new Set(retryableJobIds));
		expect(toggleAllJobSelection(selected, retryableJobIds)).toEqual(new Set());
	});
});
