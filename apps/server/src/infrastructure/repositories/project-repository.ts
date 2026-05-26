import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import { createProjectRepository } from "@solid-imager/db/repositories/project-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const ProjectRepository: IProjectRepository =
	createProjectRepository(getExecutor);
