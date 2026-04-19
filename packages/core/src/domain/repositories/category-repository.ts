import type { NewCategory, UpdateCategory } from "@/domain/categories/schemas";
import type { Transaction } from "@/domain/interfaces/transaction-manager";

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
	findById(id: string, tx?: Transaction): Promise<Category | null>;
	create(category: NewCategory, tx?: Transaction): Promise<Category>;
	update(id: string, category: UpdateCategory, tx?: Transaction): Promise<Category>;
	delete(id: string, tx?: Transaction): Promise<void>;
};
