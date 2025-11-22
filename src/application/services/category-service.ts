/**
 * CategoryService - カテゴリ管理機能
 * Feature 10: カテゴリ管理機能
 */

/**
 * Provides services for managing categories.
 */
import {
  deleteCategory,
  insertCategory,
  selectCategories,
  selectCategoryById,
  updateCategory,
} from "~/infrastructure/db/queries/categories";

/**
 * CategoryService - カテゴリ管理機能
 * Feature 10: カテゴリ管理機能
 */

/**
 * Provides services for managing categories.
 */
export const CategoryService = {
  /**
   * Retrieves all categories.
   * @returns {Promise<any>} A list of all categories.
   */
  async getAllCategories() {
    return await selectCategories();
  },

  /**
   * Creates a new category.
   * @param {object} categoryData - The data for the new category.
   * @param {string} categoryData.name - The name of the category.
   * @param {string} [categoryData.description] - An optional description for the category.
   * @param {string} [categoryData.color] - An optional color for the category.
   * @param {number} [categoryData.parentId] - An optional parent category ID.
   * @returns {Promise<any>} The newly created category.
   */
  async createCategory(categoryData: {
    name: string;
    description?: string;
    color?: string;
    parentId?: number;
  }) {
    const result = await insertCategory(categoryData);
    return result[0];
  },

  /**
   * Retrieves details of a specific category by its ID.
   * @param {number} categoryId - The ID of the category.
   * @returns {Promise<any>} The details of the specified category.
   */
  async getCategoryDetails(categoryId: number) {
    return await selectCategoryById(categoryId);
  },

  /**
   * Updates an existing category.
   * @param {number} categoryId - The ID of the category to update.
   * @param {object} categoryData - The updated data for the category.
   * @param {string} [categoryData.name] - The new name of the category.
   * @param {string} [categoryData.description] - The new description for the category.
   * @param {string} [categoryData.color] - The new color for the category.
   * @param {number} [categoryData.parentId] - The new parent category ID.
   * @returns {Promise<any>} The updated category.
   */
  async updateCategory(
    categoryId: number,
    categoryData: {
      name?: string;
      description?: string;
      color?: string;
      parentId?: number;
    }
  ) {
    return await updateCategory(categoryId, categoryData);
  },

  /**
   * Deletes a category by its ID.
   * @param {number} categoryId - The ID of the category to delete.
   * @returns {Promise<any>} Confirmation of deletion.
   */
  async deleteCategory(categoryId: number) {
    return await deleteCategory(categoryId);
  },
};
