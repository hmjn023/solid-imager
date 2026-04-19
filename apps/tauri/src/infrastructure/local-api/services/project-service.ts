import type {
	NewProject,
	Project,
	UpdateProject,
} from "@solid-imager/core/domain/projects/schemas";
import { TauriProjectRepository } from "../repositories/project-repository";

export const TauriProjectService = {
	async list(): Promise<Project[]> {
		return await TauriProjectRepository.findAll();
	},

	async get(id: string): Promise<Project | null> {
		return await TauriProjectRepository.findById(id);
	},

	async create(input: NewProject): Promise<Project> {
		return await TauriProjectRepository.create(input);
	},

	async update(id: string, input: UpdateProject): Promise<Project> {
		return await TauriProjectRepository.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await TauriProjectRepository.delete(id);
	},

	async listForMedia(mediaId: string): Promise<Project[]> {
		return await TauriProjectRepository.findByMediaId(mediaId);
	},

	async addToMedia(mediaId: string, projectId: string): Promise<void> {
		await TauriProjectRepository.addMedia(mediaId, projectId);
	},

	async removeFromMedia(mediaId: string, projectId: string): Promise<void> {
		await TauriProjectRepository.removeMedia(mediaId, projectId);
	},
};
