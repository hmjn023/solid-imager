import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { createAuthorService } from "@solid-imager/application/authors";
import { AuthorRepository } from "~/infrastructure/db/repositories";

export const AuthorService = createAuthorService(
	AuthorRepository,
	DrizzleTransactionManager,
);
