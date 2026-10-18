import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
import { describe, expect, it } from "vitest";
import {
	getRetryableJobIds,
	getJobActionIds,
	getJobActionTargetId,
	toggleAllJobSelection,
	toggleJobSelection,
} from "./jobs-selection";

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
	it("targets the batch parent for cancellation and history but keeps individual retry", () => {
		const child = { id: "child", parentId: "batch", type: "auto_tagging" };
		expect(getJobActionTargetId(child, "cancel")).toBe("batch");
		expect(getJobActionTargetId(child, "delete")).toBe("batch");
		expect(getJobActionTargetId(child, "retry")).toBe("child");
		expect(
			getJobActionTargetId({ ...child, type: "downloadImage" }, "cancel"),
		).toBe("child");
	});
	it("selects cancellation and history removal according to server capabilities", () => {
		const jobs = [
			{
				id: "parent",
				type: "bulk_tagging_parent",
				status: "in_progress" as const,
				canCancel: true,
				canDelete: false,
			},
			{
				id: "child",
				type: "auto_tagging",
				status: "failed" as const,
				canCancel: false,
				canDelete: false,
			},
			{
				id: "finished",
				type: "downloadImage",
				status: "completed" as const,
				canDelete: true,
			},
		];
		expect(getJobActionIds(jobs, "cancel")).toEqual(["parent"]);
		expect(getJobActionIds(jobs, "delete")).toEqual(["finished"]);
		expect(getJobActionIds(jobs, "retry")).toEqual(["child"]);
	});
	it("uses batch action capabilities for cancelled and blocked history", () => {
		expect(
			getRetryableJobIds([
				{ id: "cancelled-batch", status: "cancelled", canRetry: true },
				{ id: "blocked-history", status: "failed", canRetry: false },
			]),
		).toEqual(["cancelled-batch"]);
	});
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
