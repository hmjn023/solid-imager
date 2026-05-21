import type {
	NewProject,
	Project,
	UpdateProject,
} from "@solid-imager/core/domain/projects/schemas";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";

export type ProjectService = ReturnType<typeof createProjectService>;

export function createProjectService(repository: IProjectRepository) {
	return {
		async list(): Promise<Project[]> {
			return await repository.findAll();
		},

		async get(id: string): Promise<Project | null> {
			return await repository.findById(id);
		},

		async create(input: NewProject): Promise<Project> {
			return await repository.create(input);
		},

		async update(id: string, input: UpdateProject): Promise<Project> {
			return await repository.update(id, input);
		},

		async delete(id: string): Promise<void> {
			await repository.delete(id);
		},

		async listForMedia(mediaId: string): Promise<Project[]> {
			return await repository.findByMediaId(mediaId);
		},

		async addToMedia(mediaId: string, projectId: string): Promise<void> {
			await repository.addMedia(mediaId, projectId);
		},

		async removeFromMedia(mediaId: string, projectId: string): Promise<void> {
			await repository.removeMedia(mediaId, projectId);
		},
	};
}
