import { os } from "@orpc/server";
import { AuthorsRepository } from "~/infrastructure/repositories/authors-repository";

export const authorsRouter = os.router({
  list: os.handler(async () => await AuthorsRepository.list()),
});
