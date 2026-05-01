import { type AppConfig, AppConfigSchema } from "@solid-imager/core/domain/config/config-schema";
import { deepMerge } from "../utils/config-merge";

export type ConfigListener = (config: AppConfig) => void;

export type ConfigStore = {
	get(): Promise<AppConfig> | AppConfig;
	save(config: AppConfig): Promise<AppConfig> | AppConfig;
};

export class ConfigServiceImpl {
	private readonly store: ConfigStore;
	private readonly listeners = new Set<ConfigListener>();

	constructor(store: ConfigStore) {
		this.store = store;
	}

	async getConfig(): Promise<AppConfig> {
		return await this.store.get();
	}

	async updateConfig(input: Partial<AppConfig>): Promise<AppConfig> {
		const current = await this.getConfig();
		const merged = AppConfigSchema.parse(deepMerge(current, input));
		const saved = await this.store.save(merged);
		for (const listener of this.listeners) {
			listener(saved);
		}
		return saved;
	}

	onChange(listener: ConfigListener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

export function createConfigService(store: ConfigStore) {
	return new ConfigServiceImpl(store);
}
