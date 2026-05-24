import type { TagRepository as TagRepositoryDef } from "@solid-imager/core/domain/repositories/tag-repository";
import { createTagRepository } from "@solid-imager/db/repositories/tag-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const TagRepository: TagRepositoryDef = createTagRepository(getExecutor);
