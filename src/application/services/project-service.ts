import {
  deleteMediaProject,
  deleteProject,
  insertMediaProject,
  insertProject,
  selectProjectById,
  selectProjects,
  selectProjectsByMediaId,
  updateProject,
} from "~/infrastructure/db/queries/projects";

/**
 * ProjectService - プロジェクト管理機能
 */

/**
 * Provides services for managing projects.
 */
export const ProjectService = {
  /**
   * Retrieves all projects.
   * @returns {Promise<any>} A list of all projects.
   */
  async getAllProjects() {
    return await selectProjects();
  },

  /**
   * Creates a new project.
   * @param {object} projectData - The data for the new project.
   * @param {string} projectData.name - The name of the project.
   * @param {string} [projectData.description] - An optional description for the project.
   * @returns {Promise<any>} The newly created project.
   */
  async createProject(projectData: { name: string; description?: string }) {
    const result = await insertProject(projectData);
    return result;
  },

  /**
   * Retrieves details of a specific project by its ID.
   * @param {number} projectId - The ID of the project.
   * @returns {Promise<any>} The details of the specified project.
   */
  async getProjectDetails(projectId: number) {
    return await selectProjectById(projectId);
  },

  /**
   * Updates an existing project.
   * @param {number} projectId - The ID of the project to update.
   * @param {object} projectData - The updated data for the project.
   * @param {string} [projectData.name] - The new name of the project.
   * @param {string} [projectData.description] - The new description for the project.
   * @returns {Promise<any>} The updated project.
   */
  async updateProject(
    projectId: number,
    projectData: { name?: string; description?: string }
  ) {
    return await updateProject(projectId, projectData);
  },

  /**
   * Deletes a project by its ID.
   * @param {number} projectId - The ID of the project to delete.
   * @returns {Promise<any>} Confirmation of deletion.
   */
  async deleteProject(projectId: number) {
    return await deleteProject(projectId);
  },

  /**
   * Retrieves projects associated with a specific media.
   * @param {string} mediaId - The ID of the media.
   * @returns {Promise<any>} A list of projects associated with the media.
   */
  async getProjectsForMedia(mediaId: string) {
    return await selectProjectsByMediaId(mediaId);
  },

  /**
   * Adds a project to a media.
   * @param {string} mediaId - The ID of the media.
   * @param {number} projectId - The ID of the project to add.
   * @returns {Promise<any>} The created association.
   */
  async addProjectToMedia(mediaId: string, projectId: number) {
    return await insertMediaProject(mediaId, projectId);
  },

  /**
   * Removes a project from a media.
   * @param {string} mediaId - The ID of the media.
   * @param {number} projectId - The ID of the project to remove.
   * @returns {Promise<any>} Confirmation of removal.
   */
  async removeProjectFromMedia(mediaId: string, projectId: number) {
    return await deleteMediaProject(mediaId, projectId);
  },
};
