import fs from "node:fs/promises";
import path from "node:path";
import type { APIEvent } from "@solidjs/start/server";
import { and, eq } from "drizzle-orm";
import { db } from "~/infrastructure/db";
import {
  authors,
  mediaAuthors,
  mediaGenerationInfo,
  mediaSources,
  medias,
  mediaTags,
  mediaUrls,
  tags,
} from "~/infrastructure/db/schema";

type RestoreTag = {
  name: string;
  type?: "positive" | "negative";
  confidence?: number;
};

type RestoreAuthor = {
  name: string;
  accountId?: string;
};

type RestoreGenerationInfo = typeof mediaGenerationInfo.$inferInsert;

type RestoreItem = {
  filePath: string;
  fileName: string;
  description?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mediaType?: "image" | "video";
  createdAt?: string;
  modifiedAt?: string;
  generationInfo?: RestoreGenerationInfo;
  tags?: RestoreTag[];
  authors?: RestoreAuthor[];
  sourceUrls?: string[];
};

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

    const items = (await request.json()) as RestoreItem[];
    if (!Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: "Invalid dump format. Expected an array." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const mediaSource = await db.query.mediaSources.findFirst({
      where: eq(mediaSources.id, mediaSourceId),
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

    for (const item of items) {
      try {
        const result = await processRestoreItem(
          mediaSourceId,
          item,
          isLocal,
          basePath
        );
        if (result === "skipped") {
          skippedCount++;
        } else {
          processedCount++;
        }
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

async function processRestoreItem(
  mediaSourceId: string,
  item: RestoreItem,
  isLocal: boolean,
  basePath: string
): Promise<"processed" | "skipped"> {
  if (!(item.filePath && item.fileName)) {
    return "skipped";
  }

  if (isLocal) {
    const fullPath = path.join(basePath, item.filePath);
    try {
      await fs.access(fullPath);
    } catch {
      return "skipped";
    }
  }

  const mediaId = await restoreMediaItem(mediaSourceId, item);

  if (!mediaId) {
    return "skipped";
  }

  if (item.generationInfo) {
    await restoreGenerationInfo(mediaId, item.generationInfo);
  }
  if (item.tags) {
    await restoreTags(mediaId, item.tags);
  }
  if (item.authors) {
    await restoreAuthors(mediaId, item.authors);
  }
  if (item.sourceUrls) {
    await restoreUrls(mediaId, item.sourceUrls);
  }

  return "processed";
}

async function restoreMediaItem(mediaSourceId: string, item: RestoreItem) {
  const existingMedia = await db.query.medias.findFirst({
    where: and(
      eq(medias.mediaSourceId, mediaSourceId),
      eq(medias.filePath, item.filePath)
    ),
  });

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
  };

  if (existingMedia) {
    await db
      .update(medias)
      .set(mediaValues)
      .where(eq(medias.id, existingMedia.id));
    return existingMedia.id;
  }
  const inserted = await db
    .insert(medias)
    .values({
      ...mediaValues,
      // Default to 0 if width/height are undefined, assuming schema requires number
      width: mediaValues.width ?? 0,
      height: mediaValues.height ?? 0,
      indexedAt: new Date(),
    })
    .returning();
  return inserted[0].id;
}

async function restoreGenerationInfo(
  mediaId: string,
  generationInfo: RestoreGenerationInfo
) {
  if (generationInfo) {
    const { mediaId: _, ...info } = generationInfo;
    await db
      .insert(mediaGenerationInfo)
      .values({
        mediaId,
        ...info,
      })
      .onConflictDoUpdate({
        target: mediaGenerationInfo.mediaId,
        set: { ...info },
      });
  }
}

async function restoreTags(mediaId: string, tagsList: RestoreTag[]) {
  if (Array.isArray(tagsList)) {
    const tagIds: {
      id: string;
      type: "positive" | "negative";
      confidence: number | null;
    }[] = [];

    for (const t of tagsList) {
      const tagData = await restoreSingleTag(t);
      if (tagData) {
        tagIds.push(tagData);
      }
    }

    await db.delete(mediaTags).where(eq(mediaTags.mediaId, mediaId));

    // Deduplicate
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
          tagType: t.type,
          confidence: t.confidence,
          source: "restored",
        })
        .onConflictDoNothing();
    }
  }
}

async function restoreSingleTag(t: RestoreTag) {
  if (!t.name) {
    return null;
  }

  let tag = await db.query.tags.findFirst({
    where: eq(tags.name, t.name),
  });

  if (!tag) {
    const insertedTag = await db
      .insert(tags)
      .values({ name: t.name, source: "restored" })
      .onConflictDoNothing()
      .returning();
    tag = insertedTag[0];
    if (!tag) {
      tag = await db.query.tags.findFirst({
        where: eq(tags.name, t.name),
      });
    }
  }

  if (tag) {
    return {
      id: tag.id,
      type: t.type || "positive",
      confidence: t.confidence || null,
    };
  }
  return null;
}

async function restoreAuthors(mediaId: string, authorsList: RestoreAuthor[]) {
  if (Array.isArray(authorsList)) {
    await db.delete(mediaAuthors).where(eq(mediaAuthors.mediaId, mediaId));

    for (const a of authorsList) {
      if (!a.name) {
        continue;
      }

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
}

async function restoreUrls(mediaId: string, sourceUrls: string[]) {
  if (Array.isArray(sourceUrls) && sourceUrls.length > 0) {
    const existingUrls = await db.query.mediaUrls.findMany({
      where: eq(mediaUrls.mediaId, mediaId),
    });
    const existingSet = new Set(
      existingUrls.map((u: { url: string }) => u.url)
    );

    for (const url of sourceUrls) {
      if (!existingSet.has(url)) {
        await db.insert(mediaUrls).values({
          mediaId,
          url,
        });
      }
    }
  }
}
