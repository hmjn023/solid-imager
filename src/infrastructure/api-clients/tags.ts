import {
  createTag as dbCreateTag,
  deleteTag as dbDeleteTag,
  getTagById as dbGetTagById,
  getTags as dbGetTags,
  updateTag as dbUpdateTag,
} from "~/infrastructure/db/queries/tags";
import type { NewTag, Tag } from "~/infrastructure/db/schema";

/**
 * Fetches all tags from the API.
 * @returns {Promise<Tag[]>} An array of tag objects.
 */
export async function getTags(): Promise<Tag[]> {
  return await dbGetTags();
}

/**
 * Creates a new tag via the API.
 * @param {object} data - The data for the new tag.
 * @returns {Promise<Tag[]>} The newly created tag object.
 */
export async function createTag(data: NewTag): Promise<Tag[]> {
  return await dbCreateTag(data);
}

/**
 * Fetches a single tag by its ID from the API.
 * @param {number} id - The ID of the tag to fetch.
 * @returns {Promise<Tag | undefined>} The tag object matching the ID.
 */
export async function getTagById(id: number): Promise<Tag | undefined> {
  return await dbGetTagById(id);
}

/**
 * Updates an existing tag via the API.
 * @param {number} id - The ID of the tag to update.
 * @param {object} data - The updated data for the tag.
 * @returns {Promise<Tag[]>} The updated tag object.
 */
export async function updateTag(
  id: number,
  data: Partial<NewTag>
): Promise<Tag[]> {
  return await dbUpdateTag(id, data);
}

/**
 * Deletes a tag by its ID via the API.
 * @param {number} id - The ID of the tag to delete.
 * @returns {Promise<void>} An object indicating the success of the deletion.
 */
export async function deleteTag(id: number): Promise<{ success: true }> {
  await dbDeleteTag(id);
  return { success: true };
}
