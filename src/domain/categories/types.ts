/**
 * Categories Domain Types
 * Extracted from src/lib/types.ts during architecture reorganization
 */

/**
 * Represents the data for a category.
 */
export type CategoryData = {
  /**
   * The name of the category.
   */
  name: string;
  /**
   * An optional description for the category.
   */
  description?: string;
  /**
   * An optional color associated with the category.
   */
  color?: string;
  /**
   * The ID of the parent category, if it exists.
   */
  parentId?: number;
};
