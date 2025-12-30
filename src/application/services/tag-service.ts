import { cache } from "@solidjs/router";
import type {
  NewTag,
  Tag,
  TagRepository,
} from "~/domain/repositories/tag-repository";
import type { UpdateTag } from "~/domain/tags/schemas";
import { DrizzleTagRepository } from "~/infrastructure/repositories/tag-repository";

// Initialize repository
const tagRepo: TagRepository = new DrizzleTagRepository();

const getAllTagsServer = cache(async (): Promise<Tag[]> => {
  "use server";
  return await tagRepo.findAll();
}, "getAllTags");

const createTagServer = async (data: NewTag): Promise<Tag> => {
  "use server";
  return await tagRepo.create(data);
};

const getTagByIdServer = cache(async (id: string): Promise<Tag | undefined> => {
  "use server";
  const result = await tagRepo.findById(id);
  return result ?? undefined;
}, "getTagById");

const updateTagServer = async (id: string, data: UpdateTag): Promise<Tag> => {
  "use server";
  return await tagRepo.update(id, data);
};

const deleteTagServer = async (id: string): Promise<{ success: true }> => {
  "use server";
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
