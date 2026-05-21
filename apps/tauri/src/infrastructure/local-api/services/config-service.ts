import { createConfigService } from "@solid-imager/application/services/config-service";
import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { AppConfigRepository } from "../repositories/app-config-repository";

export const TauriConfigService = createConfigService({
	async get(): Promise<AppConfig> {
		return await AppConfigRepository.get();
	},
	async save(config: AppConfig): Promise<AppConfig> {
		return await AppConfigRepository.save(config);
	},
});
