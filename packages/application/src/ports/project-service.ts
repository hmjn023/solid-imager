import type {
	NewProject,
	Project,
	UpdateProject,
} from "@solid-imager/core/domain/projects/schemas";

export interface IProjectService {
	getAllProjects(): Promise<Project[]>;
	createProject(data: NewProject): Promise<Project>;
	getProjectDetails(id: string): Promise<Project | null>;
	updateProject(id: string, data: UpdateProject): Promise<Project>;
	deleteProject(id: string): Promise<void>;
	getProjectsForMedia(mediaId: string): Promise<Project[]>;
	addProjectToMedia(mediaId: string, projectId: string): Promise<void>;
	removeProjectFromMedia(mediaId: string, projectId: string): Promise<void>;
}
