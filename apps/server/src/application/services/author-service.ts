import { createAuthorService } from "@solid-imager/application/services/author-service";
import type { Author } from "@solid-imager/core/domain/media/schemas";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";

const authorService = createAuthorService(AuthorRepository);

export const AuthorService = {
	list: authorService.list,

	get: authorService.get,

	create: authorService.create,

	async update(id: string, input: Partial<Author>): Promise<Author> {
		return authorService.update(id, input);
	},

	delete: authorService.delete,

	listForMedia: authorService.listForMedia,

	addToMedia: authorService.addToMedia,

	removeFromMedia: authorService.removeFromMedia,
};
