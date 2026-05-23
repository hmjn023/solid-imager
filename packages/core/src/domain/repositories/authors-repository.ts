import type { Author } from "@/domain/authors/schemas";

export type AuthorListEntry = Author;

export type IAuthorsRepository = {
	list(): Promise<AuthorListEntry[]>;
	search(query: string): Promise<AuthorListEntry[]>;
};
