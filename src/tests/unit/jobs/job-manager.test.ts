import { beforeEach, describe, expect, it } from "vitest";
import {
  addJobsToQueue,
  getJobStats,
  type Job,
  resetJobQueue,
  startJobQueue,
} from "~/infrastructure/jobs/job-manager";

describe("JobManager", () => {
  beforeEach(() => {
    // Reset any state if possible, or use unique IDs
  });

  it("should process jobs in parallel with concurrency limit", async () => {
    const mediaSourceId = "test-source-concurrency";
    resetJobQueue(mediaSourceId);

    const jobCount = 10;
    const jobs: Job[] = Array.from({ length: jobCount }, (_, i) => ({
      mediaId: `media-${i}`,
      sourcePath: "/tmp",
      type: "thumbnail",
    }));

    addJobsToQueue(mediaSourceId, jobs);

    let activeJobs = 0;
    let maxActiveJobs = 0;

    const ProcessTimeMs = 50;
    const PollingIntervalMs = 20;
    const ConcurrencyLimit = 5;
    const MinParallelJobs = 1;

    const processor = async (_job: Job) => {
      activeJobs++;
      maxActiveJobs = Math.max(maxActiveJobs, activeJobs);
      // Simulate work that takes time
      await new Promise((resolve) => setTimeout(resolve, ProcessTimeMs));
      activeJobs--;
    };

    // Start the queue
    startJobQueue(mediaSourceId, processor, ConcurrencyLimit);

    // Wait for completion
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const stats = getJobStats(mediaSourceId);
        if (stats.status === "completed") {
          clearInterval(interval);
          resolve();
        }
      }, PollingIntervalMs);
    });

    // Verify results
    expect(maxActiveJobs).toBeLessThanOrEqual(ConcurrencyLimit); // Default limit is 5
    expect(maxActiveJobs).toBeGreaterThan(MinParallelJobs); // Should be parallel
    expect(getJobStats(mediaSourceId).processed).toBe(jobCount);
  });
});
