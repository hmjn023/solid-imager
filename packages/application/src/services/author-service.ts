import type { Author, NewAuthor } from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";

export type AuthorService = ReturnType<typeof createAuthorService>;

export function createAuthorService(repository: IAuthorRepository) {
	return {
		async getAllAuthors(): Promise<Author[]> {
			return await repository.findAll();
		},

		async getAuthor(id: string): Promise<Author | null> {
			return await repository.findById(id);
		},

		async createAuthor(input: NewAuthor): Promise<Author> {
			return await repository.create(input);
		},

		async updateAuthor(
			id: string,
			input: Partial<Pick<Author, "name" | "accountId">>,
		): Promise<Author> {
			return await repository.update(id, input);
		},

		async deleteAuthor(id: string): Promise<void> {
			await repository.delete(id);
		},

		async getAuthorsForMedia(mediaId: string): Promise<Author[]> {
			return await repository.findByMediaId(mediaId);
		},

		async addAuthorToMedia(mediaId: string, authorId: string): Promise<void> {
			await repository.addMedia(mediaId, authorId);
		},

		async removeAuthorFromMedia(mediaId: string, authorId: string): Promise<void> {
			await repository.removeMedia(mediaId, authorId);
		},
	};
}
