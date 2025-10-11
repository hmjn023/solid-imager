/**
 * CategoryService - カテゴリ管理機能
 * Feature 10: カテゴリ管理機能
 */

export const CategoryService = {
  // Feature 10: カテゴリ管理機能
  async getAllCategories() {
    // TODO: Get all categories
    throw new Error("Not implemented");
  },

  async createCategory(_categoryData: {
    name: string;
    description?: string;
    color?: string;
    parentId?: number;
  }) {
    // TODO: Create new category
    throw new Error("Not implemented");
  },

  async getCategoryDetails(_categoryId: number) {
    // TODO: Get category details by ID
    throw new Error("Not implemented");
  },

  async updateCategory(
    _categoryId: number,
    _categoryData: {
      name?: string;
      description?: string;
      color?: string;
      parentId?: number;
    }
  ) {
    // TODO: Update category
    throw new Error("Not implemented");
  },

  async deleteCategory(_categoryId: number) {
    // TODO: Delete category
    throw new Error("Not implemented");
  },
};
