import { os } from "@orpc/server";
import {
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
};
