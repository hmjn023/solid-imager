import type { Transaction } from "@/domain/interfaces/transaction-manager";
import type {
  NewProject,
  Project,
  UpdateProject,
} from "@/domain/projects/schemas";

export type IProjectRepository = {
  findAll(): Promise<Project[]>;
  findById(id: string, tx?: Transaction): Promise<Project | null>;
  create(project: NewProject, tx?: Transaction): Promise<Project>;
  update(
    id: string,
    project: UpdateProject,
    tx?: Transaction
  ): Promise<Project>;
  delete(id: string, tx?: Transaction): Promise<void>;

  // Associations
  findByMediaId(mediaId: string, tx?: Transaction): Promise<Project[]>;
  addMedia(mediaId: string, projectId: string, tx?: Transaction): Promise<void>;
  removeMedia(
    mediaId: string,
    projectId: string,
    tx?: Transaction
  ): Promise<void>;
  addMediaBulk(
    mediaId: string,
    projectIds: string[],
    tx?: Transaction
  ): Promise<void>;
};
