import { and, eq, inArray, isNull, not } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { mediaTags, tags, type NewTag, type Tag } from "~/infrastructure/db/schema";
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

      let newTags: Tag[] = [];
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

/**
 * Fetches all tags from the database.
 * @returns {Promise<Tag[]>} A promise that resolves with an array of all tags.
 */
export const getTags = async (): Promise<Tag[]> => {
  return await db.select().from(tags);
}

/**
 * Creates a new tag in the database.
 * @param {NewTag} newTag - The new tag to create.
 * @returns {Promise<Tag[]>} A promise that resolves with the created tag.
 */
export const createTag = async (newTag: NewTag): Promise<Tag[]> => {
  return await db.insert(tags).values(newTag).returning();
};

/**
 * Fetches a single tag by its ID from the database.
 * @param {number} id - The ID of the tag to fetch.
 * @returns {Promise<Tag | undefined>} A promise that resolves with the tag, or undefined if not found.
 */
export const getTagById = async (id: number): Promise<Tag | undefined> => {
  return (await db.select().from(tags).where(eq(tags.id, id)))[0];
};

/**
 * Updates an existing tag in the database.
 * @param {number} id - The ID of the tag to update.
 * @param {Partial<NewTag>} tag - The updated tag data.
 * @returns {Promise<Tag[]>} A promise that resolves with the updated tag.
 * @throws {Error} If the tag name is empty or already exists.
 */
export const updateTag = async (id: number, tag: Partial<NewTag>): Promise<Tag[]> => {
  if (tag.name === "") {
    throw new Error("Tag name cannot be empty.");
  }

  const existingTag = await db.select().from(tags).where(and(eq(tags.name, tag.name!), not(eq(tags.id, id))));
  if (existingTag.length > 0) {
    throw new Error("Tag name already exists.");
  }

  return await db.update(tags).set(tag).where(eq(tags.id, id)).returning();
};

/**
 * Deletes a tag from the database.
 * @param {number} id - The ID of the tag to delete.
 * @returns {Promise<void>}
 * @throws {Error} If the tag is associated with any media.
 */
export const deleteTag = async (id: number): Promise<void> => {
  const mediaCount = await db.select().from(mediaTags).where(eq(mediaTags.tagId, id));
  if (mediaCount.length > 0) {
    throw new Error("Cannot delete tag that is associated with media.");
  }

  await db.delete(tags).where(eq(tags.id, id));
};

/**
 * Fetches all tags for a specific media item.
 * @param {string} mediaId - The ID of the media item.
 * @returns {Promise<Tag[]>} A promise that resolves with an array of tags.
 */
export const getMediaTagsByMediaId = async (mediaId: string): Promise<Tag[]> => {
  const result = await db
    .select({
      id: tags.id,
      name: tags.name,
      description: tags.description,
      attribute: tags.attribute,
      color: tags.color,
      source: tags.source,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
    })
    .from(mediaTags)
    .innerJoin(tags, eq(mediaTags.tagId, tags.id))
    .where(eq(mediaTags.mediaId, mediaId));

  return result;
};
