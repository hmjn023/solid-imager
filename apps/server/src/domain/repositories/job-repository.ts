import type { Job, NewJob } from "~/infrastructure/db/schema";

export type IJobRepository = {
  /**
   * Creates a new job.
   * @param job - The job data to create.
   * @returns The created job.
   */
  create(job: NewJob): Promise<Job>;

  /**
   * Creates a new job only if a pending job with the same type and mediaId (in payload) does not exist.
   * @param job - The job data to create.
   * @returns The created job, or null if a duplicate exists.
   */
  createIfUnique(job: NewJob): Promise<Job | null>;

  /**
   * Finds a job by its ID.
   * @param id - The ID of the job.
   * @returns The job if found, otherwise null.
   */
  findById(id: string): Promise<Job | null>;

  /**
   * Finds pending jobs.
   * @param limit - The maximum number of jobs to retrieve.
   * @returns An array of pending jobs.
   */
  findPending(
    limit: number,
    options?: { excludeTypes?: string[]; includeTypes?: string[] }
  ): Promise<Job[]>;

  /**
   * Marks a job as in progress.
   * @param id - The ID of the job.
   */
  markAsInProgress(id: string): Promise<void>;

  /**
   * Marks a job as completed.
   * @param id - The ID of the job.
   * @param result - The result of the job.
   */
  markAsCompleted(id: string, result?: unknown): Promise<void>;

  /**
   * Marks a job as failed.
   * @param id - The ID of the job.
   * @param error - The error message.
   */
  markAsFailed(id: string, error: string): Promise<void>;

  /**
   * Updates a job.
   * @param id - The ID of the job.
   * @param data - The data to update.
   */
  update(id: string, data: Partial<Job>): Promise<void>;

  /**
   * Atomically increments the progress of a job.
   * @param id - The ID of the job.
   */
  incrementProgress(id: string): Promise<void>;
};
