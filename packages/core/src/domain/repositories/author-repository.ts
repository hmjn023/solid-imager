import type { Transaction } from "@/domain/interfaces/transaction-manager";
import type { Author, NewAuthor } from "@/domain/media/schemas";

export type IAuthorRepository = {
  findAll(): Promise<Author[]>;
  findById(id: string): Promise<Author | null>;
  // findByAccountId is implementation detail or specific query, usually usually findBy(criteria).
  // But keeping it simple for now if needed.
  // Actually, standard repo usually has specific finders.
  // Let's keep it as per previous implementation but rename interface.
  // Wait, previous file content had findByAccountId? Yes.
  // But in plan I only listed standard CRUD.
  // Let's keep findByAccountId as it was in the file I viewed.
  // But strictly speaking, findById(id) returns Author | null.
  findByAccountId?: (accountId: string) => Promise<Author | null>;
  create(author: NewAuthor, tx?: Transaction): Promise<Author>;
  update(
    id: string,
    author: Partial<NewAuthor>,
    tx?: Transaction
  ): Promise<Author>;
  delete(id: string, tx?: Transaction): Promise<void>;

  // Associations
  findByMediaId(mediaId: string, tx?: Transaction): Promise<Author[]>;
  addMedia(mediaId: string, authorId: string, tx?: Transaction): Promise<void>;
  addMediaBulk(
    mediaId: string,
    authorIds: string[],
    tx?: Transaction
  ): Promise<void>;
  removeMedia(
    mediaId: string,
    authorId: string,
    tx?: Transaction
  ): Promise<void>;
};
