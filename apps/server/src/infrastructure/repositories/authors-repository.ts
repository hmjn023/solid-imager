import type { IAuthorsRepository } from "@solid-imager/core/domain/repositories/authors-repository";
import { createAuthorsRepository } from "@solid-imager/db/repositories/authors-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const AuthorsRepository: IAuthorsRepository = createAuthorsRepository(getExecutor);
