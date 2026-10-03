import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { createAuthorService } from "@solid-imager/application/services/author-service";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";

export const AuthorService = createAuthorService(
	AuthorRepository,
	DrizzleTransactionManager,
);
