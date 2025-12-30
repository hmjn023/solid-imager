import type {
  NewProject,
  Project,
  UpdateProject,
} from "~/domain/projects/schemas";

// biome-ignore lint/style/useNamingConvention: Interface naming
export type IProjectRepository = {
  findAll(): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  create(project: NewProject): Promise<Project>;
  update(id: string, project: UpdateProject): Promise<Project>;
  delete(id: string): Promise<void>;

  // Associations
  findByMediaId(mediaId: string): Promise<Project[]>;
  addMedia(mediaId: string, projectId: string): Promise<void>;
  removeMedia(mediaId: string, projectId: string): Promise<void>;
};
