import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import { createPresetRepository } from "@solid-imager/db/repositories/preset-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const DrizzlePresetRepository: PresetRepository = createPresetRepository(getExecutor);
