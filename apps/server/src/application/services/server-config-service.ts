import { createConfigService } from "@solid-imager/application/services/config-service";
import type { IConfigService } from "@solid-imager/core";
import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { createServerConfigStore } from "./server-config-store";

const configPath = require("node:path").resolve(process.cwd(), "config.json");

const store = createServerConfigStore(configPath);
const impl = createConfigService(store);

// Sync cache for getConfig() — matches original ServerConfigService behavior
let cachedConfig: AppConfig = store.get();

// Keep cache in sync when config changes through updateConfig
impl.onChange((config) => {
	cachedConfig = config;
});

export const serverConfigService: IConfigService = {
	getConfig: () => cachedConfig,
	updateConfig: async (newConfig) => {
		cachedConfig = await impl.updateConfig(newConfig);
	},
	onChange: (listener) => impl.onChange(listener),
};

/**
 * Synchronously reloads configuration from disk.
 * Call this once at application startup.
 */
export function loadServerConfig(): void {
	cachedConfig = store.get();
}

// Backward-compat: some callers expect ServerConfigService as a named export
export { serverConfigService as ServerConfigService };
