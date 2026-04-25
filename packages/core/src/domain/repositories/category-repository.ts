import type {
	Category,
	NewCategory,
	UpdateCategory,
} from "@/domain/categories/schemas";
import type { Transaction } from "@/domain/interfaces/transaction-manager";

export type { Category };

export type CategoryRepository = {
	findAll(): Promise<Category[]>;
	findById(id: string, tx?: Transaction): Promise<Category | null>;
	create(category: NewCategory, tx?: Transaction): Promise<Category>;
	update(
		id: string,
		category: UpdateCategory,
		tx?: Transaction,
	): Promise<Category>;
	delete(id: string, tx?: Transaction): Promise<void>;
};
