import { inArray } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { mediaTags, tags } from "~/infrastructure/db/schema";
import { ConstraintError, UnknownDbError } from "../errors";

/**
 * Inserts new tags for a specific media item into the database.
 * It handles creating new tags if they don't exist and associating them with the media.
 * @param {string} mediaId - The ID of the media item to tag.
 * @param {{ name: string; type: 'positive' | 'negative' }[]} tagsToInsert - An array of tag objects to insert and associate with the media.
 * @param {string} source - The source of the tag assignment (e.g., "manual", "comfyui_workflow").
 * @returns {Promise<void>} A promise that resolves when the tags have been inserted.
 * @throws {ConstraintError} If one or more media tags already exist for the media item.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
export const insertMediaTags = async (
  mediaId: string,
  tagsToInsert: { name: string; type: "positive" | "negative" }[],
  source = "manual"
): Promise<void> => {
  try {
    await db.transaction(async (tx) => {
      const tagNames = tagsToInsert.map((t) => t.name);
      const existingTags = await tx
        .select()
        .from(tags)
        .where(inArray(tags.name, tagNames));
      const existingTagNames = existingTags.map((t) => t.name);
      const newTagNames = tagNames.filter(
        (name) => !existingTagNames.includes(name)
      );

      let newTags: (typeof tags.$inferSelect)[] = [];
      if (newTagNames.length > 0) {
        newTags = await tx
          .insert(tags)
          .values(newTagNames.map((name) => ({ name })))
          .returning();
      }

      const allTags = [...existingTags, ...newTags];
      const mediaTagsToInsert = tagsToInsert.map((tagToInsert) => {
        const foundTag = allTags.find((t) => t.name === tagToInsert.name);
        if (!foundTag) {
          throw new Error(`Tag ${tagToInsert.name} not found after insertion`);
        }
        return {
          mediaId,
          tagId: foundTag.id,
          tagType: tagToInsert.type,
          source,
        };
      });

      if (mediaTagsToInsert.length > 0) {
        await tx
          .insert(mediaTags)
          .values(mediaTagsToInsert)
          .onConflictDoNothing();
      }
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "One or more media tags already exist",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: `Failed to insert media tags for media ID: ${mediaId}`,
      details: error,
    });
  }
};
