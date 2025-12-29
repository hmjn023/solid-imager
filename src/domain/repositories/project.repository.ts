import type {
  NewProject,
  Project,
  UpdateProject,
} from "~/domain/projects/schemas";

export type ProjectRepository = {
  findAll(): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  create(project: NewProject): Promise<Project>;
  update(id: string, project: UpdateProject): Promise<Project>;
  delete(id: string): Promise<void>;
};
