import { createUserRepository } from "@solid-imager/db/repositories/user-repository";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

export const TauriUserRepository = createUserRepository(getTauriDrizzleExecutor, {
	orderByName: true,
});
