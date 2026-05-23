import type { IProjectService } from "../ports/project-service";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { NewProject, UpdateProject } from "@solid-imager/core/domain/projects/schemas";

export function createProjectService(repo: IProjectRepository): IProjectService {
  return {
    getAllProjects: () => repo.findAll(),
    createProject: (data: NewProject) => repo.create(data),
    getProjectDetails: (id: string) => repo.findById(id),
    updateProject: (id: string, data: UpdateProject) => repo.update(id, data),
    deleteProject: (id: string) => repo.delete(id),
    getProjectsForMedia: (mediaId: string) => repo.findByMediaId(mediaId),
    addProjectToMedia: (mediaId: string, projectId: string) => repo.addMedia(mediaId, projectId),
    removeProjectFromMedia: (mediaId: string, projectId: string) => repo.removeMedia(mediaId, projectId),
  };
}
