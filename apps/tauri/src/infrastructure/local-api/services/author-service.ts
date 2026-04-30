import { createAuthorService } from "@solid-imager/application/services/author-service";
import type { Author, NewAuthor } from "@solid-imager/core/domain/media/schemas";
import { TauriAuthorRepository } from "../repositories/author-repository";

const authorService = createAuthorService(TauriAuthorRepository);

export const TauriAuthorService = {
	async list(): Promise<Author[]> {
		return await authorService.list();
	},

	async get(id: string): Promise<Author | null> {
		return await authorService.get(id);
	},

	async create(input: NewAuthor): Promise<Author> {
		return await authorService.create(input);
	},

	async update(id: string, input: Partial<Pick<Author, "name" | "accountId">>): Promise<Author> {
		return await authorService.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await authorService.delete(id);
	},
};
