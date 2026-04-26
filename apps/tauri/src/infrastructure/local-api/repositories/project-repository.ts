import { createProjectRepository } from "@solid-imager/db/repositories/project-repository";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

export const TauriProjectRepository = createProjectRepository(
	getTauriDrizzleExecutor,
	{
		orderByName: true,
	},
);
