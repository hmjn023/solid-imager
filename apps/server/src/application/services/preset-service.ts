import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import type { IPresetService } from "@solid-imager/application";
import { createPresetService } from "@solid-imager/application/services/preset-service";
import { DrizzlePresetRepository } from "~/infrastructure/repositories/preset-repository";

let _service: IPresetService = createPresetService(DrizzlePresetRepository);

export const setPresetRepository = (repo: PresetRepository) => {
  _service = createPresetService(repo);
};

export const PresetService = new Proxy({} as IPresetService, {
  get(_, prop) {
    return _service[prop as keyof IPresetService];
  },
});
