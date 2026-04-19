import type { NewProject } from "@solid-imager/core/domain/projects/schemas";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";

/**
 * ProjectService - プロジェクト管理機能
 */

/**
 * Provides services for managing projects.
 */
export const ProjectService = {
	/**
	 * Retrieves all projects.
	 */
	async getAllProjects() {
		return await ProjectRepository.findAll();
	},

	/**
	 * Creates a new project.
	 */
	async createProject(projectData: { name: string; description?: string }) {
		const newProject: NewProject = {
			name: projectData.name,
			description: projectData.description,
		};
		return await ProjectRepository.create(newProject);
	},

	/**
	 * Retrieves details of a specific project by its ID.
	 */
	async getProjectDetails(projectId: string) {
		return await ProjectRepository.findById(projectId);
	},

	/**
	 * Updates an existing project.
	 */
	async updateProject(projectId: string, projectData: { name?: string; description?: string }) {
		return await ProjectRepository.update(projectId, projectData);
	},

	/**
	 * Deletes a project by its ID.
	 */
	async deleteProject(projectId: string) {
		return await ProjectRepository.delete(projectId);
	},

	/**
	 * Retrieves projects associated with a specific media.
	 */
	async getProjectsForMedia(mediaId: string) {
		return await ProjectRepository.findByMediaId(mediaId);
	},

	/**
	 * Adds a project to a media.
	 */
	async addProjectToMedia(mediaId: string, projectId: string) {
		return await ProjectRepository.addMedia(mediaId, projectId);
	},

	/**
	 * Removes a project from a media.
	 */
	async removeProjectFromMedia(mediaId: string, projectId: string) {
		return await ProjectRepository.removeMedia(mediaId, projectId);
	},
};
