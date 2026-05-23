import type { IAuthorService } from "../ports/author-service";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { Author, NewAuthor } from "@solid-imager/core/domain/media/schemas";

export function createAuthorService(repo: IAuthorRepository): IAuthorService {
  return {
    getAllAuthors: () => repo.findAll(),
    getAuthor: (id: string) => repo.findById(id),
    createAuthor: (data: NewAuthor) => repo.create(data),
    updateAuthor: (id: string, updates: Partial<Author>) => repo.update(id, updates),
    deleteAuthor: (id: string) => repo.delete(id),
  };
}
