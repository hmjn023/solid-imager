import { inArray } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { mediaTags, tags } from "~/infrastructure/db/schema";
import { ConstraintError, UnknownDbError } from "../errors";

export const insertMediaTags = async (
  mediaId: string,
  tagsToInsert: string[]
): Promise<void> => {
  try {
    await db.transaction(async (tx) => {
      const existingTags = await tx
        .select()
        .from(tags)
        .where(inArray(tags.name, tagsToInsert));
      const existingTagNames = existingTags.map((t) => t.name);
      const newTagNames = tagsToInsert.filter(
        (t) => !existingTagNames.includes(t)
      );

      let newTags: (typeof tags.$inferSelect)[] = [];
      if (newTagNames.length > 0) {
        newTags = await tx
          .insert(tags)
          .values(newTagNames.map((name) => ({ name })))
          .returning();
      }

      const allTags = [...existingTags, ...newTags];
      const mediaTagsToInsert = allTags.map((t) => ({
        mediaId,
        tagId: t.id,
      }));

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
