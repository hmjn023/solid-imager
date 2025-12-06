import fs from "node:fs/promises";
import path from "node:path";
import type { APIEvent } from "@solidjs/start/server";
import { and, eq } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import {
  authors,
  mediaAuthors,
  mediaGenerationInfo,
  medias,
  mediaTags,
  mediaUrls,
  tags,
} from "~/infrastructure/db/schema";

/**
 * @swagger
 * /api/sources/{mediaSourceId}/restore:
 *   post:
 *     summary: Restore media metadata from a JSON dump
 *     description: Restores media metadata (tags, generation info, authors, etc.) from a previously generated JSON dump. Only affects files that currently exist on the disk for local sources.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               description: Media item from dump
 *     responses:
 *       200:
 *         description: Restoration summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 processed:
 *                   type: integer
 *                 skipped:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Internal server error
 */
export async function POST({ params, request }: APIEvent) {
  try {
    const { mediaSourceId } = params;
    if (!mediaSourceId) {
      return new Response(
        JSON.stringify({ error: "Media Source ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const items = await request.json();
    if (!Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: "Invalid dump format. Expected an array." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch Media Source to get the root path
    const mediaSource = await db.query.mediaSources.findFirst({
      where: (ms, { eq: dEq }) => dEq(ms.id, mediaSourceId),
    });

    if (!mediaSource) {
      return new Response(JSON.stringify({ error: "Media source not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const connectionInfo = mediaSource.connectionInfo as { path: string };
    const basePath = connectionInfo.path;
    const isLocal = mediaSource.type === "local";

    let processedCount = 0;
    let skippedCount = 0;
    const errorMessages: string[] = [];

    // Process items in chunks or sequentially? Sequentially for now to avoid DB lock contention
    for (const item of items) {
      try {
        // Validate minimal fields
        if (!(item.filePath && item.fileName)) {
          skippedCount++;
          continue;
        }

        // Verify file existence (for local sources)
        if (isLocal) {
          const fullPath = path.join(basePath, item.filePath);
          try {
            await fs.access(fullPath);
          } catch {
            // File not found on disk, skip restoration for this item
            // (We don't want to create ghost entries that point to nothing)
            skippedCount++;
            continue;
          }
        }

        // 1. Upsert Media
        // We use sourceId + filePath as unique key
        // We do NOT use the ID from the dump to avoid PK collisions if the DB was partially populated differently.
        // We let the DB handle IDs, or reuse existing ones.

        // Check if exists
        const existingMedia = await db.query.medias.findFirst({
          where: and(
            eq(medias.mediaSourceId, mediaSourceId),
            eq(medias.filePath, item.filePath)
          ),
        });

        let mediaId = existingMedia?.id;

        const mediaValues = {
          mediaSourceId,
          filePath: item.filePath,
          fileName: item.fileName,
          description: item.description,
          width: item.width,
          height: item.height,
          fileSize: item.fileSize,
          mediaType: item.mediaType || "image",
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          modifiedAt: item.modifiedAt ? new Date(item.modifiedAt) : new Date(),
          // Don't overwrite indexedAt if exists, else now
        };

        if (existingMedia) {
          // Update
          await db
            .update(medias)
            .set(mediaValues)
            .where(eq(medias.id, existingMedia.id));
        } else {
          // Insert
          const inserted = await db
            .insert(medias)
            .values({
              ...mediaValues,
              indexedAt: new Date(),
            })
            .returning({ id: medias.id });
          mediaId = inserted[0].id;
        }

        if (!mediaId) {
          continue;
        }

        // 2. Restore Generation Info
        if (item.generationInfo) {
          await db
            .insert(mediaGenerationInfo)
            .values({
              mediaId,
              ...item.generationInfo,
            })
            .onConflictDoUpdate({
              target: mediaGenerationInfo.mediaId,
              set: { ...item.generationInfo },
            });
        }

        // 3. Restore Tags
        if (Array.isArray(item.tags)) {
          // First, ensure all tags exist in `tags` table
          const tagIds: {
            id: number;
            type: string;
            confidence: number | null;
          }[] = [];

          for (const t of item.tags) {
            if (!t.name) {
              continue;
            }

            // Try to find existing tag
            let tag = await db.query.tags.findFirst({
              where: eq(tags.name, t.name),
            });

            if (!tag) {
              // Create new tag
              const insertedTag = await db
                .insert(tags)
                .values({ name: t.name, source: "restored" })
                .onConflictDoNothing() // Handle concurrent inserts
                .returning();

              tag = insertedTag[0];

              // If onConflictDoNothing triggered and returned nothing, fetch again
              if (!tag) {
                tag = await db.query.tags.findFirst({
                  where: eq(tags.name, t.name),
                });
              }
            }

            if (tag) {
              tagIds.push({
                id: tag.id,
                type: t.type || "positive",
                confidence: t.confidence || null,
              });
            }
          }

          // Then, sync media_tags
          // Easiest strategy: Delete all for this media and re-insert
          await db.delete(mediaTags).where(eq(mediaTags.mediaId, mediaId));

          if (tagIds.length > 0) {
            // Bulk insert?
            // mediaTags has composite PK (mediaId, tagId)
            // Need to deduplicate (mediaId, tagId) pairs just in case dump has dups
            const uniqueTagLinks = new Map();
            for (const t of tagIds) {
              uniqueTagLinks.set(t.id, t);
            }

            for (const t of uniqueTagLinks.values()) {
              await db
                .insert(mediaTags)
                .values({
                  mediaId,
                  tagId: t.id,
                  tagType: t.type as "positive" | "negative",
                  confidence: t.confidence,
                  source: "restored",
                })
                .onConflictDoNothing();
            }
          }
        }

        // 4. Restore Authors
        if (Array.isArray(item.authors)) {
          await db
            .delete(mediaAuthors)
            .where(eq(mediaAuthors.mediaId, mediaId));

          for (const a of item.authors) {
            if (!a.name) {
              continue;
            }

            // Find or create author
            // logic similar to tags, but we also check accountId if present
            // For simplicity, match by name if accountId missing, or accountId if present
            // But schema doesn't force unique name.
            // Let's assume we create/find by name for now.

            let author = await db.query.authors.findFirst({
              where: eq(authors.name, a.name),
            });

            if (!author) {
              const inserted = await db
                .insert(authors)
                .values({
                  name: a.name,
                  accountId: a.accountId,
                })
                .returning();
              author = inserted[0];
            }

            if (author) {
              await db
                .insert(mediaAuthors)
                .values({
                  mediaId,
                  authorId: author.id,
                })
                .onConflictDoNothing();
            }
          }
        }

        // 5. Restore URLs
        if (Array.isArray(item.sourceUrls) && item.sourceUrls.length > 0) {
          // Just append new ones? Or sync?
          // Dump should probably be authoritative.
          // Let's check existing URLs to avoid duplicates
          const existingUrls = await db.query.mediaUrls.findMany({
            where: eq(mediaUrls.mediaId, mediaId),
          });
          const existingSet = new Set(existingUrls.map((u) => u.url));

          for (const url of item.sourceUrls) {
            if (!existingSet.has(url)) {
              await db.insert(mediaUrls).values({
                mediaId,
                url,
              });
            }
          }
        }

        processedCount++;
      } catch (err) {
        errorMessages.push(
          `Failed to restore ${item.filePath}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return new Response(
      JSON.stringify({
        processed: processedCount,
        skipped: skippedCount,
        errors: errorMessages,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (_error) {
    return new Response(
      JSON.stringify({ error: "Failed to process restore" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
