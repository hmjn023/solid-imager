import { createProjectService } from "@solid-imager/application/services/project-service";
import type {
	NewProject,
	Project,
	UpdateProject,
} from "@solid-imager/core/domain/projects/schemas";
import { TauriProjectRepository } from "../repositories/project-repository";

const projectService = createProjectService(TauriProjectRepository);

export const TauriProjectService = {
	async list(): Promise<Project[]> {
		return await projectService.getAllProjects();
	},

	async get(id: string): Promise<Project | null> {
		return await projectService.getProjectDetails(id);
	},

	async create(input: NewProject): Promise<Project> {
		return await projectService.createProject(input);
	},

	async update(id: string, input: UpdateProject): Promise<Project> {
		return await projectService.updateProject(id, input);
	},

	async delete(id: string): Promise<void> {
		await projectService.deleteProject(id);
	},

	async listForMedia(mediaId: string): Promise<Project[]> {
		return await projectService.getProjectsForMedia(mediaId);
	},

	async addToMedia(mediaId: string, projectId: string): Promise<void> {
		await projectService.addProjectToMedia(mediaId, projectId);
	},

	async removeFromMedia(mediaId: string, projectId: string): Promise<void> {
		await projectService.removeProjectFromMedia(mediaId, projectId);
	},
};
