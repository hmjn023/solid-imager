import { createAuthorsRepository, type AuthorListEntry } from "@solid-imager/db/repositories/authors-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const AuthorsRepository: ReturnType<typeof createAuthorsRepository> = createAuthorsRepository(getExecutor);
export type { AuthorListEntry };
