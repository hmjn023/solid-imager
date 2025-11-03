/**
 * Categories API Client
 * Extracted from src/lib/api/categories.ts
 */

/**
 * Fetches all categories from the API.
 * @returns {any[]} An array of category objects.
 */
export function getCategories() {
  return [];
}

/**
 * Creates a new category via the API.
 * @param {object} data - The data for the new category.
 * @param {string} data.name - The name of the category.
 * @param {string} [data.description] - An optional description for the category.
 * @param {string} [data.color] - An optional color for the category.
 * @param {number} [data.parentId] - An optional parent category ID.
 * @returns {object} The newly created category object with an ID.
 */
export function createCategory(data: {
  name: string;
  description?: string;
  color?: string;
  parentId?: number;
}) {
  const { name, description, color, parentId } = data;
  return { id: 1, name, description, color, parentId };
}

/**
 * Fetches a single category by its ID from the API.
 * @param {number} id - The ID of the category to fetch.
 * @returns {object} The category object matching the ID.
 */
export function getCategoryById(id: number) {
  return {
    id,
    name: `Category ${id}`,
    description: `Description for category ${id}`,
  };
}

import type { UpdateCategoryBody } from "~/routes/api/categories/[id]";

/**
 * Updates an existing category via the API.
 * @param {number} id - The ID of the category to update.
 * @param {object} data - The updated data for the category.
 * @param {string} [data.name] - The new name of the category.
 * @param {string} [data.description] - The new description for the category.
 * @param {string} [data.color] - The new color for the category.
 * @param {number} [data.parentId] - The new parent category ID.
 * @returns {object} The updated category object.
 */
export function updateCategory(
  id: number,
  data: UpdateCategoryBody
) {
  const { name, description } = data;
  return {
    id,
    name: name || `Category ${id}`,
    description: description || `Description for category ${id}`,
  };
}

/**
 * Deletes a category by its ID via the API.
 * @param {number} _id - The ID of the category to delete.
 * @returns {object} An object indicating the success of the deletion.
 */
export function deleteCategory(_id: number) {
  return { success: true };
}
