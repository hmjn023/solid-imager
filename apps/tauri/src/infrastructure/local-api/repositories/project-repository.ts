import { createProjectRepository } from "@solid-imager/db/repositories/project-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";

function getExecutor(tx?: unknown): DrizzleExecutor {
	return (tx ?? getTauriAppServices().db) as DrizzleExecutor;
}

export const TauriProjectRepository = createProjectRepository(getExecutor, {
	orderByName: true,
});
