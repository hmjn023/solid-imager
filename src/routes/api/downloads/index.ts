/**
 * POST /api/downloads
 * Bulk download images from JSON metadata
 */

import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";
import { bulkDownloadRequestSchema } from "~/domain/media/schemas";
import { queueDownloadJobs } from "~/infrastructure/jobs/download-jobs";
import { logger } from "~/infrastructure/logger";

/**
 * Handles bulk image download requests.
 * Accepts a JSON payload with media source ID and array of download items.
 * Each item contains an image URL and optional metadata (tweet info, timestamp, author).
 *
 * @param event - The API event containing the request
 * @returns JSON response with success status and job count
 *
 * @example
 * POST /api/downloads
 * {
 *   "mediaSourceId": "uuid-here",
 *   "items": [
 *     {
 *       "imageUrl": "https://example.com/image.jpg",
 *       "tweetUrl": "https://x.com/user/status/123",
 *       "tweetText": "Sample tweet",
 *       "timestamp": "2025-11-24T04:05:10.000Z",
 *       "authorName": "Author Name",
 *       "authorId": "@author"
 *     }
 *   ]
 * }
 */
export async function POST(event: APIEvent) {
  try {
    const body = await event.request.json();
    const validated = bulkDownloadRequestSchema.parse(body);

    const jobCount = await queueDownloadJobs(
      validated.mediaSourceId,
      validated.items
    );

    return json(
      {
        success: true,
        jobCount,
        message: `Queued ${jobCount} download jobs`,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      logger.error({ err: error }, "Failed to queue download jobs");
      return json(
        {
          success: false,
          jobCount: 0,
          message: error.message,
        },
        { status: 400 }
      );
    }

    logger.error({ err: error }, "Unknown error in download jobs");
    return json(
      {
        success: false,
        jobCount: 0,
        message: "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
