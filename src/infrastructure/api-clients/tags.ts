import {
  getTags as dbGetTags,
  createTag as dbCreateTag,
  getTagById as dbGetTagById,
  updateTag as dbUpdateTag,
  deleteTag as dbDeleteTag,
} from "~/infrastructure/db/queries/tags";
import type { tags } from "~/infrastructure/db/schema";

/**
 * Fetches all tags from the API.
 * @returns {Promise<(typeof tags.$inferSelect)[]>} An array of tag objects.
 */
export async function getTags() {
  return await dbGetTags();
}

/**
 * Creates a new tag via the API.
 * @param {object} data - The data for the new tag.
 * @returns {Promise<(typeof tags.$inferSelect)[]>} The newly created tag object.
 */
export async function createTag(data: typeof tags.$inferInsert) {
  return await dbCreateTag(data);
}

/**
 * Fetches a single tag by its ID from the API.
 * @param {number} id - The ID of the tag to fetch.
 * @returns {Promise<(typeof tags.$inferSelect) | undefined>} The tag object matching the ID.
 */
export async function getTagById(id: number) {
  return await dbGetTagById(id);
}

/**
 * Updates an existing tag via the API.
 * @param {number} id - The ID of the tag to update.
 * @param {object} data - The updated data for the tag.
 * @returns {Promise<(typeof tags.$inferSelect)[]>} The updated tag object.
 */
export async function updateTag(id: number, data: Partial<typeof tags.$inferInsert>) {
  return await dbUpdateTag(id, data);
}

/**
 * Deletes a tag by its ID via the API.
 * @param {number} id - The ID of the tag to delete.
 * @returns {Promise<void>} An object indicating the success of the deletion.
 */
export async function deleteTag(id: number) {
  await dbDeleteTag(id);
  return { success: true };
}
