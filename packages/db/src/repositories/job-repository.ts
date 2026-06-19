import type {
  IJobRepository,
  Job,
  NewJob,
} from "@solid-imager/core/domain/repositories/job-repository";
import { jobs } from "../schema";
import type { DrizzleExecutor } from "../types";

import { and, asc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { isJobStatus } from "@solid-imager/core/utils/type-guards";

function mapJob(row: typeof jobs.$inferSelect): Job {
  return {
    id: row.id,
    type: row.type,
    mediaSourceId: row.mediaSourceId,
    status: isJobStatus(row.status) ? row.status : "pending",
    payload: row.payload,
    result: row.result,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    parentId: row.parentId,
  };
}

export function createJobRepository(
  getExecutor: (tx?: unknown) => DrizzleExecutor,
): IJobRepository {
  const db = () => getExecutor();

  return {
    async create(job: NewJob): Promise<Job> {
      const [created] = await db().insert(jobs).values(job).returning();
      return mapJob(created);
    },

    async createIfUnique(job: NewJob): Promise<Job | null> {
      if (job.type === "sync_lancedb_delta" && job.mediaSourceId) {
        const [pending] = await db()
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.type, job.type),
              eq(jobs.mediaSourceId, job.mediaSourceId),
              eq(jobs.status, "pending"),
            ),
          )
          .limit(1);

        if (pending) {
          await db()
            .update(jobs)
            .set({
              payload: mergeDeltaPayload(pending.payload, job.payload),
              updatedAt: new Date(),
            })
            .where(eq(jobs.id, pending.id));
          return null;
        }

        const [created] = await db().insert(jobs).values(job).returning();
        return mapJob(created);
      }

      if (
        ["sync_lancedb", "sync_lancedb_full", "sync_lancedb_delta"].includes(job.type) &&
        job.mediaSourceId
      ) {
        const [existing] = await db()
          .select({ id: jobs.id })
          .from(jobs)
          .where(
            and(
              inArray(
                jobs.type,
                job.type === "sync_lancedb_delta"
                  ? ["sync_lancedb_delta"]
                  : ["sync_lancedb", "sync_lancedb_full"],
              ),
              eq(jobs.mediaSourceId, job.mediaSourceId),
              inArray(jobs.status, ["pending", "in_progress"]),
            ),
          )
          .limit(1);

        if (existing) {
          return null;
        }

        const [created] = await db().insert(jobs).values(job).returning();
        return mapJob(created);
      }

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
        const [created] = await db().insert(jobs).values(job).onConflictDoNothing().returning();

        return created ? mapJob(created) : null;
      }

      return this.create(job);
    },

    async findById(id: string): Promise<Job | null> {
      const [job] = await db().select().from(jobs).where(eq(jobs.id, id));
      return job ? mapJob(job) : null;
    },

    async findPending(
      limit: number,
      options?: { excludeTypes?: string[]; includeTypes?: string[] },
    ): Promise<Job[]> {
      if (options?.excludeTypes?.length && options?.includeTypes?.length) {
        throw new Error("Cannot use excludeTypes and includeTypes simultaneously.");
      }

      const conditions = [eq(jobs.status, "pending"), ne(jobs.type, "import_request")];

      if (options?.excludeTypes?.length) {
        conditions.push(notInArray(jobs.type, options.excludeTypes));
      }

      if (options?.includeTypes?.length) {
        conditions.push(inArray(jobs.type, options.includeTypes));
      }

      const rows = await db()
        .select()
        .from(jobs)
        .where(and(...conditions))
        .orderBy(asc(jobs.createdAt))
        .limit(limit);
      return rows.map(mapJob);
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
          result: result ?? null,
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
      const updates: Partial<typeof jobs.$inferInsert> = {};
      if (data.type !== undefined) updates.type = data.type;
      if (data.mediaSourceId !== undefined) updates.mediaSourceId = data.mediaSourceId;
      if (data.status !== undefined) updates.status = data.status;
      if (data.payload !== undefined) updates.payload = data.payload;
      if (data.result !== undefined) updates.result = data.result;
      if (data.error !== undefined) updates.error = data.error;
      if (data.parentId !== undefined) updates.parentId = data.parentId;
      updates.updatedAt = new Date();

      await db().update(jobs).set(updates).where(eq(jobs.id, id));
    },

    async incrementProgress(id: string): Promise<void> {
      await db().execute(
        sql`UPDATE ${jobs} SET payload = jsonb_set(payload, '{processed}', (COALESCE(payload->>'processed', '0')::int + 1)::text::jsonb) WHERE id = ${id}`,
      );
    },
  };
}

function mergeDeltaPayload(existing: unknown, next: unknown): Record<string, unknown> {
  const existingRecord = isRecord(existing) ? existing : {};
  const nextRecord = isRecord(next) ? next : {};
  const mediaIds = [
    ...extractStringArray(existingRecord.mediaIds),
    ...extractStringArray(nextRecord.mediaIds),
  ];
  return {
    ...existingRecord,
    ...nextRecord,
    mediaIds: [...new Set(mediaIds)],
  };
}

function extractStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
