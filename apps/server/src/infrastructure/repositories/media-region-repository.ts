import type { IMediaRegionRepository } from "@solid-imager/core/domain/repositories/media-region-repository";
import { createMediaRegionRepository } from "@solid-imager/db/repositories/media-region-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const DrizzleMediaRegionRepository: IMediaRegionRepository =
	createMediaRegionRepository(getExecutor);
