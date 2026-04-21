import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import { createAuthorRepository } from "@solid-imager/db/repositories/author-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db/index";

export const AuthorRepository: IAuthorRepository = createAuthorRepository(
	(tx) => (tx ?? db) as DrizzleExecutor,
);
