import type {
	AppConfig,
	AppConfigUpdate,
} from "../domain/config/config-schema";

/** Accesses application configuration and subscribes to subsequent changes. */
export type IConfigService = {
	getConfig(): AppConfig;
	updateConfig(config: AppConfigUpdate): Promise<void>;
	onChange(callback: (config: AppConfig) => void): void;
};
