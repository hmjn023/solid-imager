import type { AppConfig, AppConfigUpdate } from "@/domain/config/config-schema";

export type IConfigService = {
	getConfig(): AppConfig;
	updateConfig(config: AppConfigUpdate): Promise<void>;
	onChange(callback: (config: AppConfig) => void): void;
};
