/**
 * Categories Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents the data structure for a category.
 * @property {string} name - The name of the category.
 * @property {string} [description] - An optional description for the category.
 * @property {string} [color] - An optional color associated with the category, typically in hex format.
 * @property {number} [parentId] - An optional ID of the parent category, if this is a subcategory.
 */
export type CategoryData = {
  name: string;
  description?: string;
  color?: string;
  parentId?: number;
};
