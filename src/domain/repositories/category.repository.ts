import type { NewCategory, UpdateCategory } from "~/domain/categories/schemas";

// Define strict Category entity as it is not fully exported from schemas yet
// Assuming similar structure to Drizzle schema but domain-pure
export type Category = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryRepository = {
  findAll(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  create(category: NewCategory): Promise<Category>;
  update(id: string, category: UpdateCategory): Promise<Category>;
  delete(id: string): Promise<void>;
};
