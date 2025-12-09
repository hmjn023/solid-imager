/**
 * TagService - Tag Management Service
 */

import {
  createTag as dbCreateTag,
  deleteTag as dbDeleteTag,
  getTagById as dbGetTagById,
  getTags as dbGetTags,
  updateTag as dbUpdateTag,
} from "~/infrastructure/db/queries/tags";
import type { NewTag, Tag } from "~/infrastructure/db/schema";

export const TagService = {
  /**
   * Fetches all tags.
   * @returns {Promise<Tag[]>} An array of tag objects.
   */
  async getAllTags(): Promise<Tag[]> {
    return await dbGetTags();
  },

  /**
   * Creates a new tag.
   * @param {NewTag} data - The data for the new tag.
   * @returns {Promise<Tag>} The newly created tag object.
   */
  async createTag(data: NewTag): Promise<Tag> {
    return await dbCreateTag(data);
  },

  /**
   * Fetches a single tag by its ID.
   * @param {number} id - The ID of the tag to fetch.
   * @returns {Promise<Tag | undefined>} The tag object matching the ID.
   */
  async getTagById(id: number): Promise<Tag | undefined> {
    return await dbGetTagById(id);
  },

  /**
   * Updates an existing tag.
   * @param {number} id - The ID of the tag to update.
   * @param {Partial<NewTag>} data - The updated data for the tag.
   * @returns {Promise<Tag>} The updated tag object.
   */
  async updateTag(id: number, data: Partial<NewTag>): Promise<Tag> {
    return await dbUpdateTag(id, data);
  },

  /**
   * Deletes a tag by its ID.
   * @param {number} id - The ID of the tag to delete.
   * @returns {Promise<{ success: true }>} An object indicating the success of the deletion.
   */
  async deleteTag(id: number): Promise<{ success: true }> {
    await dbDeleteTag(id);
    return { success: true };
  },
};
