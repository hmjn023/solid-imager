import { describe, expect, it, vi } from "vite-plus/test";
import { SourceJobProgressTracker } from "../services/job-progress-tracker";

describe("SourceJobProgressTracker", () => {
	it("emits progress and completion once per registered source total", async () => {
		const jobProgress = vi.fn(async () => undefined);
		const allJobsCompleted = vi.fn(async () => undefined);
		const tracker = new SourceJobProgressTracker({
			jobProgress,
			allJobsCompleted,
		});

		tracker.register("source-1");
		tracker.register("source-1");

		await tracker.markDone("source-1");
		await tracker.markDone("source-1");
		await tracker.markDone("source-1");

		expect(jobProgress).toHaveBeenCalledTimes(2);
		expect(jobProgress).toHaveBeenNthCalledWith(1, {
			sourceId: "source-1",
			processed: 1,
			total: 2,
		});
		expect(jobProgress).toHaveBeenNthCalledWith(2, {
			sourceId: "source-1",
			processed: 2,
			total: 2,
		});
		expect(allJobsCompleted).toHaveBeenCalledTimes(1);
		expect(allJobsCompleted).toHaveBeenCalledWith({
			sourceId: "source-1",
			processed: 2,
		});
	});
});
