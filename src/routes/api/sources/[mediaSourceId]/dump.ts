import { Readable } from "node:stream";
import type { APIEvent } from "@solidjs/start/server";
import archiver from "archiver";
import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import { mediaSources, medias } from "~/infrastructure/db/schema";
import { getDriver } from "~/infrastructure/storage/factory";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/dump:
 *   get:
 *     summary: Dump media data for a source
 *     description: Exports all media data including metadata, tags, and URLs for a specific media source as a JSON file. If mode=zip is specified, it returns a ZIP file containing the JSON dump and all image files.
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
 *       - in: query
 *         name: mode
 *         required: false
 *         schema:
 *           type: string
 *           enum: [json, zip]
 *         description: The dump mode. 'json' returns only metadata (default), 'zip' returns metadata and images.
 *     responses:
 *       200:
 *         description: JSON dump or ZIP file download
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
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request (missing ID)
 *       404:
 *         description: Media source not found
 *       500:
 *         description: Internal server error
 */
export async function GET({ params, request }: APIEvent) {
  try {
    const { mediaSourceId } = params;
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") || "json";

    if (!mediaSourceId) {
      return new Response(
        JSON.stringify({ error: "Media Source ID is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 1. Fetch Media Source Info (needed for Driver)
    const mediaSource = await db.query.mediaSources.findFirst({
      where: eq(mediaSources.id, mediaSourceId),
    });

    if (!mediaSource) {
      return new Response(JSON.stringify({ error: "Media Source not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Fetch Media Data (Relational query)
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

    // 3. Transform to "restoration-ready" format
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

    // 4. Handle Response based on Mode
    if (mode === "zip") {
      const driver = getDriver(mediaSource);

      // Initialize Archiver
      const archive = archiver("zip", {
        zlib: { level: 9 }, // Sets the compression level.
      });

      // Handle archiving errors
      archive.on("error", (_err) => {
        // Do not throw, as it crashes the process.
        // We can't really change the response status here if it's already started streaming.
        // But we can prevent uncaught exceptions.
      });

      // Create a pass-through stream to pipe the archive to the response
      // Since Response expects a ReadableStream (Web API) or BodyInit, and archiver pipes to Node Writable.
      // We can use a Transform stream or simply collect the data?
      // For large files, streaming is better.
      // SolidStart/Vinxi runs on Node (usually) or Bun.
      // Let's try to construct a ReadableStream from the archive.

      // Trick: Create a PassThrough stream (Node) and convert it to Web ReadableStream if necessary.
      // But standard Response in Bun/Node often accepts Node Streams if casted, or we can use `Readable.toWeb` (Node 16+).

      const { PassThrough } = await import("node:stream");
      const passThrough = new PassThrough();
      archive.pipe(passThrough);

      // Add Metadata JSON
      archive.append(jsonString, { name: "dump.json" });

      // Add Images
      // We process sequentially to avoid overwhelming the driver/fs
      for (const media of mediaList) {
        try {
          const buffer = await driver.get(media.filePath);
          archive.append(buffer, { name: `images/${media.filePath}` });
        } catch (_e) {
          // Optional: Add an error log file to the zip? Or just skip.
          // Skipping is safer to ensure the zip is generated even if some files are missing.
        }
      }

      // Finalize the archive (this indicates we are done appending)
      archive.finalize();

      // Return stream response
      // Note: In Bun, `new Response(nodeStream)` works?
      // Usually `Readable.toWeb` is safer for compatibility.
      const webStream = Readable.toWeb(passThrough);

      return new Response(webStream as any, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="source-${mediaSourceId}-dump.zip"`,
        },
      });
    }
    // Default JSON mode
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
