import type { JobEvent } from "@solid-imager/core/domain/sources/events";
import { describe, expect, it, vi } from "vitest";
import {
	dispatchJobEvent,
	shouldSubscribeToJobEvents,
} from "./use-batch-job-events";

describe("useBatchJobEvents", () => {
	it("keeps the stream subscribed before a CCIP job is queued", () => {
		const inactiveJobId = vi.fn(() => null);
		expect(shouldSubscribeToJobEvents(inactiveJobId, {})).toBe(false);
		expect(inactiveJobId).toHaveBeenCalledOnce();

		const immediateJobId = vi.fn(() => null);
		expect(
			shouldSubscribeToJobEvents(immediateJobId, {
				subscribeImmediately: true,
			}),
		).toBe(true);
		expect(immediateJobId).not.toHaveBeenCalled();
	});

	it("dispatches a matching completion event after the job ID is set", () => {
		const handleJobCompleted = vi.fn();
		const event: JobEvent = {
			event: "job-completed",
			data: { jobId: "job-1", message: "completed" },
		};

		dispatchJobEvent("job-1", event, {
			handleJobProgress: vi.fn(),
			handleJobCompleted,
			handleJobFailed: vi.fn(),
		});

		expect(handleJobCompleted).toHaveBeenCalledWith(event.data);
	});
});
