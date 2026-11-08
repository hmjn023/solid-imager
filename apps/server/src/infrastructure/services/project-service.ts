import { createProjectService } from "@solid-imager/application/projects";
import { ProjectRepository } from "~/infrastructure/db/repositories";

export const ProjectService = createProjectService(ProjectRepository);
