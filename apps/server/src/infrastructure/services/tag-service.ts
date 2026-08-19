import { createTagService } from "@solid-imager/application/services/tag-service";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";

export const TagService = createTagService(TagRepository);
