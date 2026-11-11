import type { JobDto } from "@solid-imager/core/jobs";
import { describe, expect, it } from "vitest";
import {
	getRetryableJobIds,
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
	it("returns only failed job ids", () => {
		expect(getRetryableJobIds(jobs)).toEqual([
			"00000000-0000-4000-8000-000000000001",
			"00000000-0000-4000-8000-000000000003",
		]);
	});

	it("excludes batch history, batch items and import requests from standalone Retry", () => {
		expect(
			getRetryableJobIds([
				{
					id: "parent",
					status: "failed",
					type: "bulk_tagging_parent",
					parentId: null,
				},
				{
					id: "embedding",
					status: "failed",
					type: "extract_embedding_batch",
					parentId: null,
				},
				{
					id: "child",
					status: "failed",
					type: "auto_tagging",
					parentId: "parent",
				},
				{
					id: "approval",
					status: "failed",
					type: "import_request",
					parentId: null,
				},
				{
					id: "standalone",
					status: "failed",
					type: "auto_tagging",
					parentId: null,
				},
			]),
		).toEqual(["standalone"]);
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
