import { createAuthorRepository } from "@solid-imager/db/repositories/author-repository";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

export const TauriAuthorRepository = createAuthorRepository(getTauriDrizzleExecutor, {
	orderByName: true,
});
