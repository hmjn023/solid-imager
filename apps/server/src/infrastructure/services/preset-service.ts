import {
	type IPresetService,
	createPresetService,
} from "@solid-imager/application/presets";
import type { PresetRepository } from "@solid-imager/core/presets";
import { DrizzlePresetRepository } from "~/infrastructure/db/repositories";

let _service: IPresetService = createPresetService(DrizzlePresetRepository);

export const setPresetRepository = (repo: PresetRepository) => {
	_service = createPresetService(repo);
};

export const PresetService = new Proxy({} as IPresetService, {
	get(_, prop) {
		const value = _service[prop as keyof IPresetService];
		return typeof value === "function" ? value.bind(_service) : value;
	},
});
