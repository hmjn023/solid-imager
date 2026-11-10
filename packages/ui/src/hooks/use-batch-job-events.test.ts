import type { JobEvent } from "@solid-imager/core/events";
import { describe, expect, it, vi } from "vitest";
import {
	dispatchJobEvent,
	rememberJobEvent,
	shouldSubscribeToJobEvents,
} from "./use-batch-job-events";

describe("useBatchJobEvents", () => {
	it("does not treat a cancellation request as a terminal event", () => {
		const handlers = {
			handleJobProgress: vi.fn(),
			handleJobCompleted: vi.fn(),
			handleJobFailed: vi.fn(),
			handleJobCancelled: vi.fn(),
		};
		dispatchJobEvent(
			"tracked",
			{ event: "job-cancellation-requested", data: { jobId: "tracked" } },
			handlers,
		);
		expect(handlers.handleJobCancelled).not.toHaveBeenCalled();
		expect(handlers.handleJobCompleted).not.toHaveBeenCalled();
	});
	it("keeps terminal events received before the start response ahead of late progress", () => {
		const buffer = new Map<string, JobEvent>();
		rememberJobEvent(buffer, {
			event: "job-completed",
			data: { jobId: "early" },
		});
		rememberJobEvent(buffer, {
			event: "job-progress",
			data: { jobId: "early", processed: 1, total: 2 },
		});
		expect(buffer.get("early")?.event).toBe("job-completed");
		rememberJobEvent(buffer, {
			event: "job-retried",
			data: { jobId: "early" },
		});
		rememberJobEvent(buffer, {
			event: "job-progress",
			data: { jobId: "early", processed: 1, total: 2 },
		});
		expect(buffer.get("early")?.event).toBe("job-progress");
	});
	it("dispatches cancellation only for the tracked job", () => {
		const handleJobCancelled = vi.fn();
		const handlers = {
			handleJobProgress: vi.fn(),
			handleJobCompleted: vi.fn(),
			handleJobFailed: vi.fn(),
			handleJobCancelled,
		};
		const event: JobEvent = {
			event: "job-cancelled",
			data: { jobId: "tracked" },
		};
		dispatchJobEvent("other", event, handlers);
		expect(handleJobCancelled).not.toHaveBeenCalled();
		dispatchJobEvent("tracked", event, handlers);
		expect(handleJobCancelled).toHaveBeenCalledOnce();
	});
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
