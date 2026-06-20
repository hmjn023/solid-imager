import type {
	Author,
	NewAuthor,
} from "@solid-imager/core/domain/media/schemas";

export interface IAuthorService {
	getAllAuthors(): Promise<Author[]>;
	getAuthor(id: string): Promise<Author | null>;
	createAuthor(data: NewAuthor): Promise<Author>;
	updateAuthor(id: string, updates: Partial<Author>): Promise<Author>;
	deleteAuthor(id: string): Promise<void>;
}
