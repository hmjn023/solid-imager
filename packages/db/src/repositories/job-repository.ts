import { and, asc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import type {
  IJobRepository,
  Job,
  NewJob,
} from "@solid-imager/core/domain/repositories/job-repository";
import { jobs } from "../schema";
import type { DrizzleExecutor } from "../types";

export function createJobRepository(
  getExecutor: (tx?: unknown) => DrizzleExecutor,
): IJobRepository {
  const db = () => getExecutor();

  return {
    async create(job: NewJob): Promise<Job> {
      const [created] = await db().insert(jobs).values(job).returning();
      return created as unknown as Job;
    },

    async createIfUnique(job: NewJob): Promise<Job | null> {
      const payload = job.payload;
      let mediaId: string | undefined;

      if (
        payload &&
        typeof payload === "object" &&
        "mediaId" in payload &&
        typeof (payload as { mediaId: unknown }).mediaId === "string"
      ) {
        mediaId = (payload as { mediaId: string }).mediaId;
      }

      if (mediaId) {
        const [created] = await db()
          .insert(jobs)
          .values(job)
          .onConflictDoNothing()
          .returning();

        return (created ?? null) as unknown as Job | null;
      }

      return this.create(job);
    },

    async findById(id: string): Promise<Job | null> {
      const [job] = await db().select().from(jobs).where(eq(jobs.id, id));
      return (job || null) as unknown as Job | null;
    },

    findPending(
      limit: number,
      options?: { excludeTypes?: string[]; includeTypes?: string[] },
    ): Promise<Job[]> {
      if (options?.excludeTypes?.length && options?.includeTypes?.length) {
        throw new Error(
          "Cannot use excludeTypes and includeTypes simultaneously.",
        );
      }

      const conditions = [
        eq(jobs.status, "pending"),
        ne(jobs.type, "import_request"),
      ];

      if (options?.excludeTypes?.length) {
        conditions.push(notInArray(jobs.type, options.excludeTypes));
      }

      if (options?.includeTypes?.length) {
        conditions.push(inArray(jobs.type, options.includeTypes));
      }

      return db()
        .select()
        .from(jobs)
        .where(and(...conditions))
        .orderBy(asc(jobs.createdAt))
        .limit(limit) as Promise<Job[]>;
    },

    async markAsInProgress(id: string): Promise<void> {
      await db()
        .update(jobs)
        .set({
          status: "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
    },

    async markAsCompleted(id: string, result?: unknown): Promise<void> {
      await db()
        .update(jobs)
        .set({
          status: "completed",
          result: result as any,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
    },

    async markAsFailed(id: string, error: string): Promise<void> {
      await db()
        .update(jobs)
        .set({
          status: "failed",
          error,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, id));
    },

    async update(id: string, data: Partial<Job>): Promise<void> {
      await db()
        .update(jobs)
        .set(data as any)
        .where(eq(jobs.id, id));
    },

    async incrementProgress(id: string): Promise<void> {
      await db().execute(
        sql`UPDATE ${jobs} SET payload = jsonb_set(payload, '{processed}', (COALESCE(payload->>'processed', '0')::int + 1)::text::jsonb) WHERE id = ${id}`,
      );
    },
  };
}
