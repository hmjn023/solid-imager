import type { ICollectionRepository } from "@solid-imager/core/domain/repositories/collection-repository";
import { createCollectionRepository } from "@solid-imager/db/repositories/collection-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db/index";

export const CollectionRepository: ICollectionRepository =
	createCollectionRepository((tx) => (tx ?? db) as DrizzleExecutor);
