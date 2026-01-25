import { and, asc, eq, ne } from "drizzle-orm";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import { db } from "~/infrastructure/db";
import { type Job, jobs, type NewJob } from "~/infrastructure/db/schema";

export class JobRepository implements IJobRepository {
  async create(job: NewJob): Promise<Job> {
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }

  async findById(id: string): Promise<Job | null> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || null;
  }

  findPending(limit: number): Promise<Job[]> {
    return db
      .select()
      .from(jobs)
      .where(and(eq(jobs.status, "pending"), ne(jobs.type, "import_request")))
      .orderBy(asc(jobs.createdAt))
      .limit(limit);
  }

  async markAsInProgress(id: string): Promise<void> {
    await db
      .update(jobs)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id));
  }

  async markAsCompleted(id: string, result?: unknown): Promise<void> {
    await db
      .update(jobs)
      .set({
        status: "completed",
        // biome-ignore lint/suspicious/noExplicitAny: jsonb handles any
        result: result as any,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id));
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    await db
      .update(jobs)
      .set({
        status: "failed",
        error,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id));
  }
}
