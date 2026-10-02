import type { TransactionManager } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { NewAuthor } from "@solid-imager/core/domain/media/schemas";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { IAuthorService } from "../ports/author-service";

export function createAuthorService(
	repo: IAuthorRepository,
	transactions: TransactionManager,
): IAuthorService {
	return {
		confirmAccount: (input) =>
			transactions.transaction((tx) => repo.confirmAccount(input, tx)),
		getAllAuthors: () => repo.findAll(),
		listMedia: (input) => repo.listMedia(input),
		correctMedia: (input) =>
			transactions.transaction((tx) => repo.correctMedia(input, tx)),
		merge: (input) => transactions.transaction((tx) => repo.merge(input, tx)),
		getAuthor: (id: string) => repo.findById(id),
		createAuthor: (data: NewAuthor) => repo.create(data),
		updateAuthor: (id: string, updates: Partial<NewAuthor>) =>
			repo.update(id, updates),
		deleteAuthor: (id: string) => repo.delete(id),
	};
}
