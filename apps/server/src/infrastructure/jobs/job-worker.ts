import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import type { Job } from "~/infrastructure/db/schema";
import { logger } from "~/infrastructure/logger";

export class JobWorker {
  private isRunning = false;
  private timeoutId: NodeJS.Timeout | null = null;
  private pollIntervalMs = 1000;
  private concurrency = 3;
  private aiConcurrency = 1;
  private activeJobs = 0;
  private activeAiJobs = 0;

  private readonly jobRepo: IJobRepository;
  private readonly processor: (job: Job) => Promise<void>;

  private readonly aiJobTypes = new Set([
    "auto_tagging",
    "ccip_extraction",
    "similarity_calculation",
  ]);

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
    const oldAiConcurrency = this.aiConcurrency;
    const oldPollInterval = this.pollIntervalMs;

    this.concurrency = config.jobs.concurrency;
    this.aiConcurrency = config.jobs.aiConcurrency;
    this.pollIntervalMs = config.jobs.pollIntervalMs;

    if (
      (oldConcurrency !== this.concurrency ||
        oldAiConcurrency !== this.aiConcurrency ||
        oldPollInterval !== this.pollIntervalMs) &&
      this.isRunning
    ) {
      logger.info(
        {
          concurrency: this.concurrency,
          aiConcurrency: this.aiConcurrency,
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
      // 1. Poll AI Jobs
      if (this.activeAiJobs < this.aiConcurrency) {
        const slots = this.aiConcurrency - this.activeAiJobs;
        if (slots > 0) {
          const jobs = await this.jobRepo.findPending(slots, {
            includeTypes: Array.from(this.aiJobTypes),
          });
          for (const job of jobs) {
            this.processJob(job);
          }
        }
      }

      // 2. Poll Other Jobs
      // "concurrency" is treated as the limit for NON-AI jobs in this independent pool model
      const activeOtherJobs = this.activeJobs - this.activeAiJobs;
      if (activeOtherJobs < this.concurrency) {
        const slots = this.concurrency - activeOtherJobs;
        if (slots > 0) {
          const jobs = await this.jobRepo.findPending(slots, {
            excludeTypes: Array.from(this.aiJobTypes),
          });
          for (const job of jobs) {
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
    const isAiJob = this.aiJobTypes.has(job.type);
    if (isAiJob) {
      this.activeAiJobs++;
    }

    try {
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
      if (isAiJob) {
        this.activeAiJobs--;
      }
    }
  }
}
