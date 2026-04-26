import { createSourceRepository } from "@solid-imager/db/repositories/source-repository";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

export const TauriSourceRepository = createSourceRepository(getTauriDrizzleExecutor, {
	orderByName: true,
});
