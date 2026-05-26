import type { ICollectionRepository } from "@solid-imager/core/domain/repositories/collection-repository";
import { createCollectionRepository } from "@solid-imager/db/repositories/collection-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const CollectionRepository: ICollectionRepository =
	createCollectionRepository(getExecutor);
