import { createAuthorService } from "@solid-imager/application/services/author-service";
import type { Author } from "@solid-imager/core/domain/media/schemas";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";

const authorService = createAuthorService(AuthorRepository);

export const AuthorService = {
	getAllAuthors: authorService.getAllAuthors,

	getAuthor: authorService.getAuthor,

	createAuthor: authorService.createAuthor,

	async updateAuthor(id: string, input: Partial<Author>): Promise<Author> {
		return authorService.updateAuthor(id, input);
	},

	deleteAuthor: authorService.deleteAuthor,
};
