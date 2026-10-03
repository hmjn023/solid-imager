import type { Transaction } from "@/domain/interfaces/transaction-manager";
import type {
	Author,
	NewAuthor,
	AuthorMediaListInput,
	AuthorMediaPage,
	CorrectMediaAuthorsInput,
	MergeAuthorsInput,
	ConfirmAuthorAccountInput,
} from "@/domain/authors/schemas";

export type IAuthorRepository = {
	confirmAccount(
		input: ConfirmAuthorAccountInput,
		tx: Transaction,
	): Promise<Author>;
	findAll(): Promise<Author[]>;
	listMedia(input: AuthorMediaListInput): Promise<AuthorMediaPage>;
	correctMedia(
		input: CorrectMediaAuthorsInput,
		tx: Transaction,
	): Promise<number>;
	merge(input: MergeAuthorsInput, tx: Transaction): Promise<number>;
	findById(id: string): Promise<Author | null>;
	findByName(name: string, tx?: Transaction): Promise<Author | null>;
	findByNames(names: string[], tx?: Transaction): Promise<Author[]>;
	create(author: NewAuthor, tx?: Transaction): Promise<Author>;
	update(
		id: string,
		author: Partial<NewAuthor>,
		tx?: Transaction,
	): Promise<Author>;
	delete(id: string, tx?: Transaction): Promise<void>;

	// Associations
	findByMediaId(mediaId: string, tx?: Transaction): Promise<Author[]>;
	addMedia(mediaId: string, authorId: string, tx?: Transaction): Promise<void>;
	addMediaBulk(
		mediaId: string,
		authorIds: string[],
		tx?: Transaction,
	): Promise<void>;
	removeMedia(
		mediaId: string,
		authorId: string,
		tx?: Transaction,
	): Promise<void>;

	/** Bulk find-or-create authors, preferring platform-scoped account identity. */
	findOrCreateBulk(authors: NewAuthor[], tx?: Transaction): Promise<Author[]>;
};
