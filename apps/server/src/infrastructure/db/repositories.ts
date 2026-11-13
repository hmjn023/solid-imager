import { createRepositories } from "@solid-imager/db";
import { logger } from "~/infrastructure/logger";
import { getExecutor } from "./executor";

export const {
	mediaGroup: MediaGroupRepository,
	author: AuthorRepository,
	category: DrizzleCategoryRepository,
	character: DrizzleCharacterRepository,
	collection: CollectionRepository,
	ip: IpRepository,
	job: JobRepository,
	media: MediaRepository,
	preset: DrizzlePresetRepository,
	project: ProjectRepository,
	searchSnapshot: SearchSnapshotRepository,
	source: DrizzleSourceRepository,
	tag: TagRepository,
	user: UserRepository,
	allocateJobId,
} = createRepositories(getExecutor, logger);
