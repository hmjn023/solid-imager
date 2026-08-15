import { implement } from "@orpc/server";
import { authorsContract } from "@solid-imager/core/domain/contract/authors.contract";
import { AuthorsRepository } from "~/infrastructure/repositories/authors-repository";

const os = implement(authorsContract);

export const authorsRouter = os.router({
	list: os.list.handler(async () => await AuthorsRepository.list()),
});
