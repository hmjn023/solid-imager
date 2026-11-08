import { createTagService } from "@solid-imager/application/tags";
import { TagRepository } from "~/infrastructure/db/repositories";

export const TagService = createTagService(TagRepository);
