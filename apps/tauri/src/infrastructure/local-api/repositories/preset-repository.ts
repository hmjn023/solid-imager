import { createPresetRepository } from "@solid-imager/db/repositories/preset-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";

export const TauriPresetRepository = createPresetRepository(
	() => getTauriAppServices().db as DrizzleExecutor,
);
