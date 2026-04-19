import type { Author, NewAuthor } from "@solid-imager/core/domain/media/schemas";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";

export const AuthorService = {
	async getAllAuthors(): Promise<Author[]> {
		return await AuthorRepository.findAll();
	},

	async getAuthor(id: string): Promise<Author | null> {
		return await AuthorRepository.findById(id);
	},

	async createAuthor(authorData: NewAuthor): Promise<Author> {
		return await AuthorRepository.create(authorData);
	},

	async updateAuthor(id: string, updates: Partial<Author>): Promise<Author> {
		return await AuthorRepository.update(id, updates);
	},

	async deleteAuthor(id: string): Promise<void> {
		await AuthorRepository.delete(id);
	},
};
