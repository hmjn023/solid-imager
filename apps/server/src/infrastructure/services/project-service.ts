import { createProjectService } from "@solid-imager/application/services/project-service";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";

export const ProjectService = createProjectService(ProjectRepository);
