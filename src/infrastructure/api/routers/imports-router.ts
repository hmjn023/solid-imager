import { os } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { downloadItemSchema } from "~/domain/media/schemas";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";
import { SseManager } from "~/infrastructure/jobs/sse-manager";

/**
 * Imports Router Implementation
 */
export const importsRouter = {
  /**
   * Bulk add items from Xtracter.
   * Checks for duplicates and creates import_request jobs.
   */
  bulkAdd: os
    .input(z.object({ items: z.array(downloadItemSchema) }))
    .handler(async ({ input }) => {
      const { items } = input;
      if (items.length === 0) {
        return { addedCount: 0, skippedCount: 0, restoredCount: 0 };
      }

      // 1. Duplicate Check Skipped (as requested by user)
      // The requirement for duplicate URL checking has been removed.
      // All incoming items are treated as new requests.

      const itemsToProcess = items;
      const skippedCount = 0;
      let addedCount = 0;

      // 2. Create Import Jobs
      if (itemsToProcess.length > 0) {
        const jobValues = itemsToProcess.map((item) => ({
          type: "import_request",
          status: "pending" as const,
          payload: item,
          updatedAt: new Date(),
        }));

        // Chunking inserts
        const ChunkSize = 100;
        for (let i = 0; i < jobValues.length; i += ChunkSize) {
          const chunk = jobValues.slice(i, i + ChunkSize);
          await db.insert(jobs).values(chunk);
        }
        addedCount = itemsToProcess.length;

        SseManager.sendEvent("global-imports", "import-request:created", {
          count: addedCount,
        });
      }

      return { addedCount, skippedCount, restoredCount: 0 };
    }),

  /**
   * List pending import requests.
   */
  listPending: os.handler(async () => {
    const pendingJobs = await db.query.jobs.findMany({
      where: and(eq(jobs.type, "import_request"), eq(jobs.status, "pending")),
      orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    });

    return pendingJobs.map((job) => ({
      id: job.id,
      item: job.payload as z.infer<typeof downloadItemSchema>,
      createdAt: job.createdAt,
    }));
  }),

  /**
   * Process selected import requests (Queue downloads).
   */
  process: os
    .input(
      z.object({
        jobIds: z.array(z.string().uuid()),
        targetSourceId: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      const { jobIds, targetSourceId } = input;

      // Detect if jobIds is empty
      if (jobIds.length === 0) {
        return { success: true, processedCount: 0 };
      }

      // Fetch jobs
      const importJobs = await db.query.jobs.findMany({
        where: and(inArray(jobs.id, jobIds), eq(jobs.type, "import_request")),
      });

      const itemsToDownload = importJobs.map(
        (job) => job.payload as z.infer<typeof downloadItemSchema>
      );

      if (itemsToDownload.length > 0) {
        await queueDownloadJobs(targetSourceId, itemsToDownload);
      }

      // Update jobs to completed
      await db
        .update(jobs)
        .set({ status: "completed", updatedAt: new Date() })
        .where(inArray(jobs.id, jobIds));

      SseManager.sendEvent("global-imports", "import-request:processed", {
        processedCount: itemsToDownload.length,
      });

      return { success: true, processedCount: itemsToDownload.length };
    }),

  /**
   * Cancel/Delete import requests.
   */
  cancel: os
    .input(
      z.object({
        jobIds: z.array(z.string().uuid()),
      })
    )
    .handler(async ({ input }) => {
      const { jobIds } = input;
      if (jobIds.length === 0) {
        return { success: true };
      }

      await db.delete(jobs).where(inArray(jobs.id, jobIds));
      SseManager.sendEvent("global-imports", "import-request:deleted", {
        jobIds,
      });
      return { success: true };
    }),

  /**
   * Real-time events stream for imports
   */
  events: os.handler(async function* ({ signal }) {
    // Yield initial connection event
    yield { event: "connected", data: "connected" };

    // Queue for events
    // biome-ignore lint/suspicious/noExplicitAny: SSE payload
    const queue: { event: string; data: any }[] = [];
    let resolve: (() => void) | null = null;

    const mediaSourceId = "global-imports";

    // biome-ignore lint/suspicious/noExplicitAny: SSE payload is dynamic
    const onEvent = (payload: { event: string; data: any }) => {
      queue.push(payload);
      if (resolve) {
        resolve();
        resolve = null;
      }
    };

    const eventName = `event:${mediaSourceId}`;
    SseManager.emitter.on(eventName, onEvent);

    try {
      while (!signal?.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((r) => {
            const onAbort = () => {
              r();
            };
            if (signal) {
              signal.addEventListener("abort", onAbort, { once: true });
            }
            resolve = () => {
              if (signal) {
                signal.removeEventListener("abort", onAbort);
              }
              r();
            };
          });
        }

        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
            yield item;
          }
        }
      }
    } finally {
      SseManager.emitter.off(eventName, onEvent);
    }
  }),
};
