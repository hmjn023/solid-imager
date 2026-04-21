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
	async getAllProjects() {
		return await projectService.getAllProjects();
	},

	/**
	 * Creates a new project.
	 */
	async createProject(projectData: { name: string; description?: string }) {
		const newProject: NewProject = {
			name: projectData.name,
			description: projectData.description,
		};
		return await projectService.createProject(newProject);
	},

	/**
	 * Retrieves details of a specific project by its ID.
	 */
	async getProjectDetails(projectId: string) {
		return await projectService.getProjectDetails(projectId);
	},

	/**
	 * Updates an existing project.
	 */
	async updateProject(
		projectId: string,
		projectData: { name?: string; description?: string },
	) {
		return await projectService.updateProject(projectId, projectData);
	},

	/**
	 * Deletes a project by its ID.
	 */
	async deleteProject(projectId: string) {
		return await projectService.deleteProject(projectId);
	},

	/**
	 * Retrieves projects associated with a specific media.
	 */
	async getProjectsForMedia(mediaId: string) {
		return await projectService.getProjectsForMedia(mediaId);
	},

	/**
	 * Adds a project to a media.
	 */
	async addProjectToMedia(mediaId: string, projectId: string) {
		return await projectService.addProjectToMedia(mediaId, projectId);
	},

	/**
	 * Removes a project from a media.
	 */
	async removeProjectFromMedia(mediaId: string, projectId: string) {
		return await projectService.removeProjectFromMedia(mediaId, projectId);
	},
};
