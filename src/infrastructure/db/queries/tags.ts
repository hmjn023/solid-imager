import { eq, inArray } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import {
  mediaTags,
  type NewTag,
  type Tag,
  tags,
} from "~/infrastructure/db/schema";
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
          .values(newTagNames.map((name) => ({ name, source })))
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

/**
 * Retrieves all tags from the database.
 * @returns {Promise<Tag[]>} A promise that resolves to an array of tag objects.
 * @throws {UnknownDbError} If a database error occurs during the retrieval.
 */
export const getTags = async (): Promise<Tag[]> => {
  try {
    return await db.select().from(tags);
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to retrieve tags",
      details: error,
    });
  }
};

/**
 * Creates a new tag in the database.
 * @param {NewTag} data - The data for the new tag.
 * @returns {Promise<Tag>} A promise that resolves to the newly created tag object.
 * @throws {ConstraintError} If a tag with the same name already exists.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
export const createTag = async (data: NewTag): Promise<Tag> => {
  try {
    const [newTag] = await db.insert(tags).values(data).returning();
    return newTag;
  } catch (dbError) {
    if (
      dbError &&
      typeof dbError === "object" &&
      "code" in dbError &&
      dbError.code === "23505"
    ) {
      throw new ConstraintError({
        message: `Tag with name '${data.name}' already exists`,
        details: dbError,
      });
    }
    throw new UnknownDbError({
      message: `Failed to create tag with name '${data.name}'`,
      details: dbError,
    });
  }
};

/**
 * Retrieves a single tag by its ID from the database.
 * @param {number} id - The ID of the tag to fetch.
 * @returns {Promise<Tag | undefined>} A promise that resolves to the tag object matching the ID, or undefined if not found.
 * @throws {UnknownDbError} If a database error occurs during the retrieval.
 */
export const getTagById = async (id: number): Promise<Tag | undefined> => {
  try {
    const [tag] = await db.select().from(tags).where(eq(tags.id, id));
    return tag;
  } catch (dbError) {
    throw new UnknownDbError({
      message: `Failed to retrieve tag with ID: ${id}`,
      details: dbError,
    });
  }
};

/**
 * Updates an existing tag in the database.
 * @param {number} id - The ID of the tag to update.
 * @param {Partial<NewTag>} data - The updated data for the tag.
 * @returns {Promise<Tag>} A promise that resolves to the updated tag object.
 * @throws {ConstraintError} If a tag with the same name already exists.
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
export const updateTag = async (
  id: number,
  data: Partial<NewTag>
): Promise<Tag> => {
  try {
    const [updatedTag] = await db
      .update(tags)
      .set(data)
      .where(eq(tags.id, id))
      .returning();
    return updatedTag;
  } catch (dbError) {
    if (
      dbError &&
      typeof dbError === "object" &&
      "code" in dbError &&
      dbError.code === "23505"
    ) {
      throw new ConstraintError({
        message: `Tag with name '${data.name}' already exists`,
        details: dbError,
      });
    }
    throw new UnknownDbError({
      message: `Failed to update tag with ID: ${id}`,
      details: dbError,
    });
  }
};

/**
 * Deletes a tag by its ID from the database.
 * @param {number} id - The ID of the tag to delete.
 * @returns {Promise<void>} A promise that resolves when the tag has been deleted.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
export const deleteTag = async (id: number): Promise<void> => {
  try {
    await db.delete(tags).where(eq(tags.id, id));
  } catch (dbError) {
    throw new UnknownDbError({
      message: `Failed to delete tag with ID: ${id}`,
      details: dbError,
    });
  }
};
