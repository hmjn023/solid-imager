import type {
	AuthorMediaListInput,
	AuthorMediaPage,
	CorrectMediaAuthorsInput,
	MergeAuthorsInput,
	Author,
	NewAuthor,
	ConfirmAuthorAccountInput,
} from "@solid-imager/core/domain/authors/schemas";

export interface IAuthorService {
	confirmAccount(input: ConfirmAuthorAccountInput): Promise<Author>;
	getAllAuthors(): Promise<Author[]>;
	listMedia(input: AuthorMediaListInput): Promise<AuthorMediaPage>;
	correctMedia(input: CorrectMediaAuthorsInput): Promise<number>;
	merge(input: MergeAuthorsInput): Promise<number>;
	getAuthor(id: string): Promise<Author | null>;
	createAuthor(data: NewAuthor): Promise<Author>;
	updateAuthor(id: string, updates: Partial<NewAuthor>): Promise<Author>;
	deleteAuthor(id: string): Promise<void>;
}
