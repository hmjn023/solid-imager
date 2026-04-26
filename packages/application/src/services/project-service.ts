import type {
	NewProject,
	Project,
	UpdateProject,
} from "@solid-imager/core/domain/projects/schemas";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";

export type ProjectService = ReturnType<typeof createProjectService>;

export function createProjectService(repository: IProjectRepository) {
	return {
		async getAllProjects(): Promise<Project[]> {
			return await repository.findAll();
		},

		async getProjectDetails(id: string): Promise<Project | null> {
			return await repository.findById(id);
		},

		async createProject(input: NewProject): Promise<Project> {
			return await repository.create(input);
		},

		async updateProject(id: string, input: UpdateProject): Promise<Project> {
			return await repository.update(id, input);
		},

		async deleteProject(id: string): Promise<void> {
			await repository.delete(id);
		},

		async getProjectsForMedia(mediaId: string): Promise<Project[]> {
			return await repository.findByMediaId(mediaId);
		},

		async addProjectToMedia(mediaId: string, projectId: string): Promise<void> {
			await repository.addMedia(mediaId, projectId);
		},

		async removeProjectFromMedia(mediaId: string, projectId: string): Promise<void> {
			await repository.removeMedia(mediaId, projectId);
		},
	};
}
