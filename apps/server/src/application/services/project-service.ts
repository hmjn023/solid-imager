import { createProjectService } from "@solid-imager/application/services/project-service";
import type { NewProject } from "@solid-imager/core/domain/projects/schemas";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";

/**
 * ProjectService - プロジェクト管理機能
 */

const projectService = createProjectService(ProjectRepository);

/**
 * Provides services for managing projects.
 */
export const ProjectService = {
	/**
	 * Retrieves all projects.
	 */
	async list() {
		return await projectService.list();
	},

	/**
	 * Creates a new project.
	 */
	async create(projectData: { name: string; description?: string }) {
		const newProject: NewProject = {
			name: projectData.name,
			description: projectData.description,
		};
		return await projectService.create(newProject);
	},

	/**
	 * Retrieves details of a specific project by its ID.
	 */
	async get(projectId: string) {
		return await projectService.get(projectId);
	},

	/**
	 * Updates an existing project.
	 */
	async update(
		projectId: string,
		projectData: { name?: string; description?: string },
	) {
		return await projectService.update(projectId, projectData);
	},

	/**
	 * Deletes a project by its ID.
	 */
	async delete(projectId: string) {
		return await projectService.delete(projectId);
	},

	/**
	 * Retrieves projects associated with a specific media.
	 */
	async listForMedia(mediaId: string) {
		return await projectService.listForMedia(mediaId);
	},

	/**
	 * Adds a project to a media.
	 */
	async addToMedia(mediaId: string, projectId: string) {
		return await projectService.addToMedia(mediaId, projectId);
	},

	/**
	 * Removes a project from a media.
	 */
	async removeFromMedia(mediaId: string, projectId: string) {
		return await projectService.removeFromMedia(mediaId, projectId);
	},
};
