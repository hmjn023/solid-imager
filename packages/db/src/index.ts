import { createAuthorRepository } from "./repositories/author-repository";
import { createCategoryRepository } from "./repositories/category-repository";
import { createCharacterRepository } from "./repositories/character-repository";
import { createCollectionRepository } from "./repositories/collection-repository";
import { createIpRepository } from "./repositories/ip-repository";
import {
	allocateJobId,
	createJobRepository,
} from "./repositories/job-repository";
import { createMediaRepository } from "./repositories/media-repository";
import { createPresetRepository } from "./repositories/preset-repository";
import { createProjectRepository } from "./repositories/project-repository";
import { createSearchSnapshotRepository } from "./repositories/search-snapshot-repository";
import { createSourceRepository } from "./repositories/source-repository";
import { createTagRepository } from "./repositories/tag-repository";
import { createUserRepository } from "./repositories/user-repository";
import type { DrizzleExecutor } from "./types";

export type { DrizzleExecutor } from "./types";
export { createTransactionManager } from "./transaction-manager";

/** Wire the repositories together once, preserving transaction-aware executor lookup. */
export function createRepositories(
	getExecutor: (tx?: unknown) => DrizzleExecutor,
	logger: {
		info(data: unknown, message?: string): void;
		error(data: unknown, message?: string): void;
	},
) {
	const author = createAuthorRepository(getExecutor);
	const tag = createTagRepository(getExecutor);
	return {
		author,
		category: createCategoryRepository(getExecutor),
		character: createCharacterRepository(getExecutor),
		collection: createCollectionRepository(getExecutor),
		ip: createIpRepository(getExecutor),
		job: createJobRepository(getExecutor),
		media: createMediaRepository(getExecutor, {
			authorRepository: author,
			tagRepository: tag,
			logger,
		}),
		preset: createPresetRepository(getExecutor),
		project: createProjectRepository(getExecutor),
		searchSnapshot: createSearchSnapshotRepository(getExecutor),
		source: createSourceRepository(getExecutor),
		tag,
		user: createUserRepository(getExecutor),
		allocateJobId: () => allocateJobId(getExecutor),
	};
}
