import type { AppConfig } from "~/domain/config/config-schema";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import type { Job } from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";

export class JobWorker {
  private isRunning = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private pollIntervalMs = 1000;
  private concurrency = 3;
  private activeJobs = 0;

  private readonly jobRepo: IJobRepository;
  private readonly processor: (job: Job) => Promise<void>;

  constructor(jobRepo: IJobRepository, processor: (job: Job) => Promise<void>) {
    this.jobRepo = jobRepo;
    this.processor = processor;
  }

  start() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    logger.info("Job processing worker started");
    this.poll();
  }

  stop() {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    logger.info("Job processing worker stopped");
  }

  updateConfig(config: AppConfig) {
    const oldConcurrency = this.concurrency;
    const oldPollInterval = this.pollIntervalMs;

    this.concurrency = config.jobs.concurrency;
    this.pollIntervalMs = config.jobs.pollIntervalMs;

    if (
      (oldConcurrency !== this.concurrency ||
        oldPollInterval !== this.pollIntervalMs) &&
      this.isRunning
    ) {
      logger.info(
        {
          concurrency: this.concurrency,
          pollIntervalMs: this.pollIntervalMs,
        },
        "JobWorker config updated"
      );
    }
  }

  private async poll() {
    if (!this.isRunning) {
      return;
    }

    try {
      if (this.activeJobs < this.concurrency) {
        const slots = this.concurrency - this.activeJobs;
        if (slots > 0) {
          const jobs = await this.jobRepo.findPending(slots);
          // Mark them as in-progress immediately upon fetching to avoid double processing?
          // or rely on single consumer for now.
          // For now, processJob marks them. Ideally finding should lock them or mark them.
          // Since we are single instance for now, it's okay.
          // If we were multi-instance, we'd need 'UPDATE ... RETURNING' or similar in findPending.
          // Current findPending just looks for 'pending'.

          // To be safer, we should probably handle them one by one or ensure findPending is atomic for multi-instance,
          // but for this task, a simple loop is sufficient start.

          for (const job of jobs) {
            // We fire and forget the processJob (it's async), but we increment activeJobs synchronously.
            // Wait, processJob is async. If we await it inside the loop, we are serial processing the batch.
            // We want parallel processing within the batch.
            this.processJob(job);
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Error polling for jobs");
    }

    if (this.isRunning) {
      this.timeoutId = setTimeout(() => this.poll(), this.pollIntervalMs);
    }
  }

  private async processJob(job: Job) {
    this.activeJobs++;
    try {
      // It's possible another worker picked it up if we had multiple workers.
      // But assuming single worker for now.
      await this.jobRepo.markAsInProgress(job.id);

      await this.processor(job);

      await this.jobRepo.markAsCompleted(job.id, { success: true });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error({ err: error, jobId: job.id }, "Job failed");
      await this.jobRepo.markAsFailed(job.id, errorMessage);
    } finally {
      this.activeJobs--;
    }
  }
}
