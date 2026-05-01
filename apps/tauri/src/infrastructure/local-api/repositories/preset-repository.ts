import { createPresetRepository } from "@solid-imager/db/repositories/preset-repository";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

export const TauriPresetRepository = createPresetRepository(
	getTauriDrizzleExecutor,
);
