import type { JobDto } from "@solid-imager/core/jobs";
import { describe, expect, it, vi } from "vitest";
import {
	createManagerBatchState,
	type ManagerBatchContext,
} from "./manager-batch-state";

function required<T>(value: T | null): T {
	if (value === null) throw new Error("Expected an accepted request");
	return value;
}

const tagging: ManagerBatchContext = {
	tab: "tagging",
	vectorModel: "ccip",
	force: false,
};
const vectors: ManagerBatchContext = { ...tagging, tab: "vectors" };
function job(id: string, values: Partial<JobDto> = {}): JobDto {
	return {
		id,
		type: "bulk_tagging_parent",
		mediaSourceId: null,
		status: "in_progress",
		createdAt: new Date(1),
		updatedAt: new Date(2),
		parentId: null,
		error: null,
		cancelRequestedAt: null,
		cancelledAt: null,
		attemptCount: 1,
		startedAt: new Date(1),
		finishedAt: null,
		targetMediaId: null,
		targetMediaModifiedAt: null,
		progress: { processed: 1, failed: 0, total: 5 },
		artifact: null,
		...values,
	};
}

describe("Manager batch request ownership", () => {
	it("keeps pending requests across tab changes and does not let a late response select or persist an older run", () => {
		const persist = vi.fn();
		const state = createManagerBatchState(persist);
		const first = required(state.begin("start", tagging));
		const second = required(state.begin("start", vectors));
		expect(state.pending("tagging")).toBe("start");
		expect(state.begin("start", tagging)).toBeNull();
		state.acceptStart(second, "newer");
		state.finish(second);
		state.acceptStart(first, "older");
		state.finish(first);
		expect(state.trackedRun()?.jobId).toBe("newer");
		expect(persist.mock.calls.map(([run]) => run.jobId)).toEqual(["newer"]);
		state.observe({
			event: "job-progress",
			data: { jobId: "older", processed: 2, total: 4 },
		});
		expect(state.display("tagging")?.progress?.processed).toBe(2);
		expect(state.display("vectors")?.progress).toBeNull();
		expect(state.activeJobId()).toBe("newer");
	});
	it("preserves an explicitly chosen run when an older submission completes", () => {
		const state = createManagerBatchState(vi.fn());
		const pending = required(state.begin("start", tagging));
		state.select({ ...tagging, jobId: "chosen" });
		state.acceptStart(pending, "late");
		expect(state.trackedRun()?.jobId).toBe("chosen");
		expect(state.display("tagging")?.jobId).toBe("chosen");
	});
	it("shows scan results without the previous run's completion badge or counts", () => {
		const state = createManagerBatchState(vi.fn());
		state.restore({ ...tagging, jobId: "completed" });
		state.acceptSnapshot(
			job("completed", {
				status: "completed",
				progress: { processed: 5, failed: 0, total: 5 },
			}),
			0,
		);
		const request = required(state.begin("scan", tagging));
		state.setRequestMessage(request, "3 items found.");
		state.finish(request);
		expect(state.display("tagging")).toEqual({
			kind: "scan",
			message: "3 items found.",
			status: null,
			progress: null,
			jobId: null,
		});
		expect(state.trackedRun()?.jobId).toBe("completed");
	});
	it("invalidates scan results when source/model/options change, including a round trip to the original options", () => {
		const state = createManagerBatchState(vi.fn());
		const request = required(state.begin("scan", tagging));
		state.invalidateScans();
		state.invalidateScans();
		state.setRequestMessage(request, "stale result");
		state.finish(request);
		expect(state.display("tagging")).toBeNull();
	});
});

describe("Manager GET and SSE observations", () => {
	it("keeps cancellation requests nonterminal until the committed cancellation event", () => {
		const state = createManagerBatchState(vi.fn());
		state.restore({ ...tagging, jobId: "cancel" });
		state.acceptSnapshot(job("cancel"), 0);
		state.observe({
			event: "job-cancellation-requested",
			data: { jobId: "cancel" },
		});
		expect(state.display("tagging")?.status).toBe("in_progress");
		expect(state.activeJobId()).toBe("cancel");
		state.observe({ event: "job-cancelled", data: { jobId: "cancel" } });
		expect(state.display("tagging")?.status).toBe("cancelled");
		expect(state.activeJobId()).toBeNull();
	});

	it("keeps read failures bound to their job when another remembered GET finishes late", () => {
		const state = createManagerBatchState(vi.fn());
		state.restore({ ...tagging, jobId: "old" });
		const oldRead = state.version("old");
		state.select({ ...vectors, jobId: "selected" });
		state.failRead("selected", "Selected batch unavailable");
		state.acceptSnapshot(job("old"), oldRead);
		expect(state.display("vectors")?.message).toBe(
			"Selected batch unavailable",
		);
		state.failRead("old", "Old batch no longer exists");
		expect(state.forget("old")).toBe(false);
		expect(state.trackedRun()?.jobId).toBe("selected");
		expect(
			state.acceptSnapshot(job("selected"), state.version("selected")),
		).toBe(true);
		expect(state.display("vectors")?.message).toBe("Processing...");
	});
	it("rejects a GET started before a newer event and accepts a fresh snapshot", () => {
		const state = createManagerBatchState(vi.fn());
		state.restore({ ...tagging, jobId: "tracked" });
		const oldRead = state.version("tracked");
		state.observe({
			event: "job-progress",
			data: { jobId: "tracked", processed: 4, total: 5 },
		});
		expect(state.acceptSnapshot(job("tracked"), oldRead)).toBe(false);
		expect(state.display("tagging")?.progress?.processed).toBe(4);
		expect(
			state.acceptSnapshot(
				job("tracked", { progress: { processed: 4, failed: 1, total: 5 } }),
				state.version("tracked"),
			),
		).toBe(true);
		expect(state.display("tagging")?.progress?.failed).toBe(1);
	});
	it("does not regress terminal events to running progress or an old attempt; a retry allows a new attempt", () => {
		const state = createManagerBatchState(vi.fn());
		state.restore({ ...tagging, jobId: "tracked" });
		state.acceptSnapshot(job("tracked"), 0);
		state.observe({ event: "job-completed", data: { jobId: "tracked" } });
		state.observe({
			event: "job-progress",
			data: { jobId: "tracked", processed: 2, total: 5 },
		});
		expect(state.acceptSnapshot(job("tracked"), state.version("tracked"))).toBe(
			false,
		);
		expect(state.display("tagging")?.status).toBe("completed");
		state.observe({ event: "job-retried", data: { jobId: "tracked" } });
		expect(
			state.acceptSnapshot(
				job("tracked", { attemptCount: 2, updatedAt: new Date(3) }),
				state.version("tracked"),
			),
		).toBe(true);
		expect(
			state.acceptSnapshot(
				job("tracked", {
					status: "failed",
					attemptCount: 1,
					updatedAt: new Date(4),
				}),
				state.version("tracked"),
			),
		).toBe(false);
		expect(state.display("tagging")?.status).toBe("in_progress");
	});
	it("ignores unrelated job events during restored tracking", () => {
		const state = createManagerBatchState(vi.fn());
		state.restore({ ...vectors, jobId: "restored" });
		state.observe({
			event: "job-failed",
			data: { jobId: "other-client", error: "unrelated" },
		});
		expect(state.activeJobId()).toBe("restored");
		expect(state.display("vectors")?.status).toBe("pending");
	});
});
