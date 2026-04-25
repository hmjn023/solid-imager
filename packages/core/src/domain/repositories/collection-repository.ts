import type {
	Collection,
	NewCollection,
	NewCollectionItem,
	UpdateCollection,
} from "@/domain/collections/schemas";
import type { Transaction } from "@/domain/interfaces/transaction-manager";

export type ICollectionRepository = {
	findAll(): Promise<Collection[]>;
	findById(id: string, tx?: Transaction): Promise<Collection | null>;
	create(collection: NewCollection, tx?: Transaction): Promise<Collection>;
	update(
		id: string,
		collection: UpdateCollection,
		tx?: Transaction,
	): Promise<Collection>;
	delete(id: string, tx?: Transaction): Promise<void>;
	addItem(
		collectionId: string,
		item: NewCollectionItem,
		tx?: Transaction,
	): Promise<void>;
	removeItem(
		collectionId: string,
		mediaId: string,
		tx?: Transaction,
	): Promise<void>;
};
