/**
 * Tags API Client
 * Extracted from src/lib/api/tags.ts
 */

/**
 * Fetches all tags from the API.
 * @returns {any[]} An array of tag objects.
 */
export function getTags() {
  return [];
}

/**
 * Creates a new tag via the API.
 * @param {object} data - The data for the new tag.
 * @param {string} data.name - The name of the tag.
 * @param {string} [data.description] - An optional description for the tag.
 * @param {string} [data.attribute] - An optional attribute or classification for the tag.
 * @param {string} [data.color] - An optional color for UI display.
 * @returns {object} The newly created tag object with an ID.
 */
export function createTag(data: {
  name: string;
  description?: string;
  attribute?: string;
  color?: string;
}) {
  const { name, description, attribute, color } = data;
  return { id: 1, name, description, attribute, color };
}

/**
 * Fetches a single tag by its ID from the API.
 * @param {number} id - The ID of the tag to fetch.
 * @returns {object} The tag object matching the ID.
 */
export function getTagById(id: number) {
  return { id, name: `Tag ${id}`, description: `Description for tag ${id}` };
}

import type { UpdateTagBody } from "~/routes/api/tags/[id]";

/**
 * Updates an existing tag via the API.
 * @param {number} id - The ID of the tag to update.
 * @param {object} data - The updated data for the tag.
 * @param {string} [data.name] - The new name of the tag.
 * @param {string} [data.description] - The new description for the tag.
 * @param {string} [data.attribute] - The new attribute for the tag.
 * @param {string} [data.color] - The new color for the tag.
 * @returns {object} The updated tag object.
 */
export function updateTag(
  id: number,
  data: UpdateTagBody
) {
  const { name, description } = data;
  return {
    id,
    name: name || `Tag ${id}`,
    description: description || `Description for tag ${id}`,
  };
}

/**
 * Deletes a tag by its ID via the API.
 * @param {number} _id - The ID of the tag to delete.
 * @returns {object} An object indicating the success of the deletion.
 */
export function deleteTag(_id: number) {
  return { success: true };
}
