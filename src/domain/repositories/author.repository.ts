import type { Author } from "~/domain/media/schemas";

export type NewAuthor = {
  name: string;
  accountId?: string | null;
};

export type AuthorRepository = {
  findAll(): Promise<Author[]>;
  findById(id: string): Promise<Author | null>;
  findByAccountId(accountId: string): Promise<Author | null>;
  create(author: NewAuthor): Promise<Author>;
  update(id: string, author: Partial<NewAuthor>): Promise<Author>;
  delete(id: string): Promise<void>;
};
