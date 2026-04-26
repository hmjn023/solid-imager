import { createCollectionRepository } from "@solid-imager/db/repositories/collection-repository";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

export const TauriCollectionRepository = createCollectionRepository(getTauriDrizzleExecutor, {
	orderByName: true,
});
