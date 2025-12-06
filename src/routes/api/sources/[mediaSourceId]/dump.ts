import type { APIEvent } from "@solidjs/start/server";
import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import { medias } from "~/infrastructure/db/schema";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/dump:
 *   get:
 *     summary: Dump media data for a source
 *     description: Exports all media data including metadata, tags, and URLs for a specific media source as a JSON file.
 *     tags:
 *       - Media Sources
 *     parameters:
 *       - in: path
 *         name: mediaSourceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the media source.
 *     responses:
 *       200:
 *         description: JSON file download
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   fileName:
 *                     type: string
 *                   sourceUrl:
 *                     type: string
 *                   # ... other fields
 *       500:
 *         description: Internal server error
 */
export async function GET({ params }: APIEvent) {
  try {
    const { mediaSourceId } = params;

    if (!mediaSourceId) {
      return new Response(
        JSON.stringify({ error: "Media Source ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Use relational query to fetch everything in one go
    const mediaList = await db.query.medias.findMany({
      where: eq(medias.mediaSourceId, mediaSourceId),
      with: {
        generationInfo: true,
        urls: true,
        tags: {
          with: {
            tag: true,
          },
        },
        authors: {
          with: {
            author: true,
          },
        },
      },
    });

    // Transform to a "restoration-ready" format
    const dumpData = mediaList.map((media) => {
      // Extract tags into a simple list of names/types
      const simpleTags = media.tags.map((mt) => ({
        name: mt.tag.name,
        type: mt.tagType,
        confidence: mt.confidence,
      }));

      // Extract authors
      const simpleAuthors = media.authors.map((ma) => ({
        name: ma.author.name,
        accountId: ma.author.accountId,
      }));

      // Extract source URLs (flattened)
      const sourceUrls = media.urls.map((u) => u.url);

      return {
        id: media.id,
        filePath: media.filePath,
        fileName: media.fileName,
        description: media.description,
        width: media.width,
        height: media.height,
        fileSize: media.fileSize,
        mediaType: media.mediaType,
        createdAt: media.createdAt,
        modifiedAt: media.modifiedAt,
        indexedAt: media.indexedAt,

        // Essential metadata for restoration
        sourceUrls,

        // AI Generation Info
        generationInfo: media.generationInfo
          ? {
              prompt: media.generationInfo.prompt,
              negativePrompt: media.generationInfo.negativePrompt,
              modelName: media.generationInfo.modelName,
              seed: media.generationInfo.seed,
              steps: media.generationInfo.steps,
              cfgScale: media.generationInfo.cfgScale,
              aiGenerated: media.generationInfo.aiGenerated,
              workflow: media.generationInfo.workflow, // Full workflow json
              metadata: media.generationInfo.metadata, // Other metadata
            }
          : null,

        tags: simpleTags,
        authors: simpleAuthors,
      };
    });

    const jsonString = JSON.stringify(dumpData, null, 2);

    return new Response(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="source-${mediaSourceId}-dump.json"`,
      },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Failed to generate dump" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
