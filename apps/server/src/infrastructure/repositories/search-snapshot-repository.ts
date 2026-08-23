import type { SearchSnapshotRepository as SearchSnapshotRepositoryPort } from "@solid-imager/core/domain/repositories/search-snapshot-repository";
import { createSearchSnapshotRepository } from "@solid-imager/db/repositories/search-snapshot-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const SearchSnapshotRepository: SearchSnapshotRepositoryPort =
	createSearchSnapshotRepository(getExecutor);
