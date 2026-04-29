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
		return await projectService.list();
	},

	async get(id: string): Promise<Project | null> {
		return await projectService.get(id);
	},

	async create(input: NewProject): Promise<Project> {
		return await projectService.create(input);
	},

	async update(id: string, input: UpdateProject): Promise<Project> {
		return await projectService.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await projectService.delete(id);
	},

	async listForMedia(mediaId: string): Promise<Project[]> {
		return await projectService.listForMedia(mediaId);
	},

	async addToMedia(mediaId: string, projectId: string): Promise<void> {
		await projectService.addToMedia(mediaId, projectId);
	},

	async removeFromMedia(mediaId: string, projectId: string): Promise<void> {
		await projectService.removeFromMedia(mediaId, projectId);
	},
};
