import crypto from "node:crypto";
import path from "node:path";
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
    const downloadItems = input.items.map((item) =>
      mapImportItemToDownloadItem(item)
    );

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

    const NilUuid = "00000000-0000-0000-0000-000000000000";
    if (!input.mediaSourceId || input.mediaSourceId === NilUuid) {
      throw new Error("Valid mediaSourceId is required for approval");
    }

    const payload = job.payload as z.infer<typeof bulkImportRequestSchema>;
    const selectedItems = input.selectedIndices.map(
      (idx) => payload.items[idx]
    );

    // 1. Prepare items with fixed Paths
    const itemsWithPaths = selectedItems.map((item, _index) => {
      // Use standard download filename format
      // download-{timestamp}-{index}-{originalName}
      // index is added to prevent collision since Date.now() is constant in loop
      const urlPath = new URL(item.imageUrl).pathname;
      const originalFilename = path.basename(urlPath);
      // Use standard download filename format
      // download-{hash}-{originalName} in order to make it deterministic
      const hash = crypto
        .createHash("sha256")
        .update(item.imageUrl)
        .digest("hex");
      const filename = `download-${hash}-${originalFilename}`;

      return {
        ...item,
        _targetFilePath: filename,
        _targetFileName: filename,
      };
    });

    // 2. Convert to Backup Format for metadata import
    const backupItems = itemsWithPaths.map((item) => {
      return {
        filePath: item._targetFilePath,
        fileName: item._targetFileName,
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

    // 3. Import rich metadata (tags, authors etc)
    await BackupService.importMetadata(input.mediaSourceId, backupItems);

    // 4. Queue physical downloads
    const downloadItems = itemsWithPaths.map((item) =>
      mapImportItemToDownloadItem(item, item._targetFilePath)
    );
    const jobCount = await queueDownloadJobs(
      input.mediaSourceId,
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
