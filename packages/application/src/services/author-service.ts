import type {
	Author,
	NewAuthor,
} from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";

export type AuthorService = ReturnType<typeof createAuthorService>;

export function createAuthorService(repository: IAuthorRepository) {
	return {
		async list(): Promise<Author[]> {
			return await repository.findAll();
		},

		async get(id: string): Promise<Author | null> {
			return await repository.findById(id);
		},

		async create(input: NewAuthor): Promise<Author> {
			return await repository.create(input);
		},

		async update(
			id: string,
			input: Partial<Pick<Author, "name" | "accountId">>,
		): Promise<Author> {
			return await repository.update(id, input);
		},

		async delete(id: string): Promise<void> {
			await repository.delete(id);
		},

		async listForMedia(mediaId: string): Promise<Author[]> {
			return await repository.findByMediaId(mediaId);
		},

		async addToMedia(mediaId: string, authorId: string): Promise<void> {
			await repository.addMedia(mediaId, authorId);
		},

		async removeFromMedia(mediaId: string, authorId: string): Promise<void> {
			await repository.removeMedia(mediaId, authorId);
		},
	};
}
