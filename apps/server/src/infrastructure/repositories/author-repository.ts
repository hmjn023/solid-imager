import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import { createAuthorRepository } from "@solid-imager/db/repositories/author-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const AuthorRepository: IAuthorRepository =
	createAuthorRepository(getExecutor);
