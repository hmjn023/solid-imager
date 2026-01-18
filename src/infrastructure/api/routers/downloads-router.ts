import { randomUUID } from "node:crypto";
import { os } from "@orpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { BackupService } from "~/application/services/backup-service";
import {
  approveImportRequestSchema,
  bulkImportRequestSchema,
  mapImportItemToDownloadItem,
} from "~/domain/media/import-schemas";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";

/**
 * Downloads Router Implementation
 */
export const downloadsRouter = {
  /**
   * Starts bulk download jobs
   */
  start: os.input(bulkImportRequestSchema).handler(async ({ input }) => {
    if (!input.mediaSourceId) {
      throw new Error("mediaSourceId is required for starting downloads");
    }

    // Map new ImportItem format to legacy DownloadItem format
    const downloadItems = input.items.map(mapImportItemToDownloadItem);

    const jobCount = await queueDownloadJobs(
      input.mediaSourceId,
      downloadItems
    );
    return {
      success: true,
      jobCount,
      message: `Queued ${jobCount} download jobs`,
    };
  }),

  /**
   * Saves import items for preview/approval
   */
  preview: os.input(bulkImportRequestSchema).handler(async ({ input }) => {
    const results = await db
      .insert(jobs)
      .values({
        type: "import_preview",
        mediaSourceId: input.mediaSourceId,
        status: "pending_approval",
        payload: input,
      })
      .returning();

    const job = results[0];

    return {
      success: true,
      jobId: job.id,
      message: "Import data saved for preview",
    };
  }),

  /**
   * Lists pending approval jobs
   */
  listPending: os.handler(
    async () =>
      await db.query.jobs.findMany({
        where: eq(jobs.status, "pending_approval"),
        orderBy: [desc(jobs.createdAt)],
      })
  ),

  /**
   * Gets a specific pending job
   */
  getPending: os
    .input(z.object({ jobId: z.string().uuid() }))
    .handler(async ({ input }) => {
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, input.jobId),
      });

      if (!job || job.status !== "pending_approval") {
        throw new Error("Job not found or already processed");
      }

      return job;
    }),

  /**
   * Approves selected items and starts download
   */
  approve: os.input(approveImportRequestSchema).handler(async ({ input }) => {
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, input.jobId),
    });

    if (!job || job.status !== "pending_approval") {
      throw new Error("Job not found or already processed");
    }

    const payload = job.payload as z.infer<typeof bulkImportRequestSchema>;
    const selectedItems = input.selectedIndices.map(
      (idx) => payload.items[idx]
    );

    // 1. Convert to Backup Format for metadata import
    const backupItems = selectedItems.map((item) => {
      const id = randomUUID();
      const ext = item.imageUrl.split(".").pop()?.split("?")[0] || "png";
      return {
        filePath: `pending/${id}.${ext}`,
        fileName: `pending-${id}.${ext}`,
        description: item.description,
        createdAt: item.timestamp,
        modifiedAt: item.timestamp,
        mediaType: "image", // Default
        sourceUrls: [
          item.imageUrl,
          ...(item.sourceUrl ? [item.sourceUrl] : []),
        ],
        tags: item.tags,
        authors: item.author ? [item.author] : [],
      };
    });

    // 2. Import rich metadata (tags, authors etc)
    await BackupService.importMetadata(
      input.mediaSourceId || "00000000-0000-0000-0000-000000000000",
      backupItems
    );

    // 3. Queue physical downloads
    const downloadItems = selectedItems.map(mapImportItemToDownloadItem);
    const jobCount = await queueDownloadJobs(
      input.mediaSourceId || "00000000-0000-0000-0000-000000000000",
      downloadItems
    );

    // 4. Update job status
    await db
      .update(jobs)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(jobs.id, input.jobId));

    return {
      success: true,
      jobCount,
      message: `Approved ${selectedItems.length} items and queued ${jobCount} downloads`,
    };
  }),
};
