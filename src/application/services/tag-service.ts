import type {
  NewTag,
  Tag,
  TagRepository,
} from "~/domain/repositories/tag-repository";
import type { UpdateTag } from "~/domain/tags/schemas";
import { DrizzleTagRepository } from "~/infrastructure/repositories/tag-repository";

// Initialize repository
const tagRepo: TagRepository = new DrizzleTagRepository();

const getAllTagsServer = async (): Promise<Tag[]> => await tagRepo.findAll();

const createTagServer = async (data: NewTag): Promise<Tag> =>
  await tagRepo.create(data);

const getTagByIdServer = async (id: string): Promise<Tag | undefined> => {
  const result = await tagRepo.findById(id);
  return result ?? undefined;
};

const updateTagServer = async (id: string, data: UpdateTag): Promise<Tag> =>
  await tagRepo.update(id, data);

const deleteTagServer = async (id: string): Promise<{ success: true }> => {
  await tagRepo.delete(id);
  return { success: true };
};

export const TagService = {
  getAllTags: getAllTagsServer,
  createTag: createTagServer,
  getTagById: getTagByIdServer,
  updateTag: updateTagServer,
  deleteTag: deleteTagServer,
};
