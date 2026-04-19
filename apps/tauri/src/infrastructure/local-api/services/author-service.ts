import type { Author, NewAuthor } from "@solid-imager/core/domain/media/schemas";
import { TauriAuthorRepository } from "../repositories/author-repository";

export const TauriAuthorService = {
	async list(): Promise<Author[]> {
		return await TauriAuthorRepository.findAll();
	},

	async get(id: string): Promise<Author | null> {
		return await TauriAuthorRepository.findById(id);
	},

	async create(input: NewAuthor): Promise<Author> {
		return await TauriAuthorRepository.create(input);
	},

	async update(id: string, input: Partial<Pick<Author, "name" | "accountId">>): Promise<Author> {
		return await TauriAuthorRepository.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await TauriAuthorRepository.delete(id);
	},
};
