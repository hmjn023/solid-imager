import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import { createProjectRepository } from "@solid-imager/db/repositories/project-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db";

export const ProjectRepository: IProjectRepository = createProjectRepository(
	(tx) => (tx ?? db) as DrizzleExecutor,
);
