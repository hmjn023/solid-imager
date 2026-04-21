import { createAuthorService } from "@solid-imager/application/services/author-service";
import type {
	Author,
	NewAuthor,
} from "@solid-imager/core/domain/media/schemas";
import { TauriAuthorRepository } from "../repositories/author-repository";

const authorService = createAuthorService(TauriAuthorRepository);

export const TauriAuthorService = {
	async list(): Promise<Author[]> {
		return await authorService.getAllAuthors();
	},

	async get(id: string): Promise<Author | null> {
		return await authorService.getAuthor(id);
	},

	async create(input: NewAuthor): Promise<Author> {
		return await authorService.createAuthor(input);
	},

	async update(
		id: string,
		input: Partial<Pick<Author, "name" | "accountId">>,
	): Promise<Author> {
		return await authorService.updateAuthor(id, input);
	},

	async delete(id: string): Promise<void> {
		await authorService.deleteAuthor(id);
	},
};
