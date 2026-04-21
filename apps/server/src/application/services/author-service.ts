import { createAuthorService } from "@solid-imager/application/services/author-service";
import type {
	Author,
	NewAuthor,
} from "@solid-imager/core/domain/media/schemas";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";

const authorService = createAuthorService(AuthorRepository);

export const AuthorService = {
	getAllAuthors: authorService.getAllAuthors,

	getAuthor: authorService.getAuthor,

	createAuthor: async (input: NewAuthor): Promise<Author> =>
		await authorService.createAuthor(input),

	async updateAuthor(id: string, input: Partial<Author>): Promise<Author> {
		return await authorService.updateAuthor(id, input);
	},

	deleteAuthor: authorService.deleteAuthor,
};
