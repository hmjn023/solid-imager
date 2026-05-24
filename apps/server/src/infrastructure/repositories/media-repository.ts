import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import { createMediaRepository } from "@solid-imager/db/repositories/media-repository";
import { createMediaSearchFunctions } from "@solid-imager/db/repositories/media-repository-utils";
import { getExecutor } from "~/infrastructure/db/executor";
import { logger } from "~/infrastructure/logger";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";

const mediaSearch = createMediaSearchFunctions(getExecutor);

export const MediaRepository: IMediaRepository = createMediaRepository(getExecutor, {
  logger: {
    info: (data: unknown, msg?: string) => { logger.info(data, msg); },
    error: (data: unknown, msg?: string) => { logger.error(data, msg); },
  },
  authorRepository: AuthorRepository,
  tagRepository: TagRepository,
  mediaSearch,
});
