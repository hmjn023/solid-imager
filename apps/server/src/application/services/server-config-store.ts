import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { deepMerge } from "@solid-imager/application/utils/config-merge";
import {
	type AppConfig,
	AppConfigSchema,
	defaultAppConfig,
} from "@solid-imager/core/domain/config/config-schema";
import { logger } from "~/infrastructure/logger";

export function createServerConfigStore(configPath: string): {
	get(): AppConfig;
	save(config: AppConfig): Promise<AppConfig>;
} {
	return {
		get(): AppConfig {
			let fileContent: unknown = {};

			if (fs.existsSync(configPath)) {
				try {
					const raw = fs.readFileSync(configPath, "utf-8");
					fileContent = JSON.parse(raw);
				} catch (error) {
					logger.fatal(
						{ err: error, path: configPath },
						"Failed to parse config.json. The file might be corrupted.",
					);
					throw new Error(
						`Configuration file at ${configPath} is corrupted: ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
				}

				const parsedFromFile = AppConfigSchema.safeParse(fileContent);
				if (parsedFromFile.success) {
					const merged = deepMerge(
						fileContent as Record<string, unknown>,
						parsedFromFile.data,
					);
					if (!isDeepStrictEqual(merged, fileContent)) {
						fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
						logger.info("config.json migrated with new default fields");
					}
					fileContent = merged;
				}
			} else {
				logger.info("config.json not found, creating default");
				fs.writeFileSync(configPath, JSON.stringify(defaultAppConfig, null, 2));
				fileContent = defaultAppConfig;
			}

			// Apply Env Overrides
			const envOverrides = getEnvOverrides();
			const mergedConfig = deepMerge(
				fileContent as Record<string, unknown>,
				envOverrides,
			);

			// Validate
			const result = AppConfigSchema.safeParse(mergedConfig);
			if (result.success) {
				logger.debug({ config: result.data }, "Configuration loaded");
				return result.data;
			}

			logger.error(
				{ errors: result.error.format() },
				"Invalid configuration detected. Using fallback/defaults where possible.",
			);
			throw new Error(
				`Invalid configuration: ${JSON.stringify(result.error.format())}`,
			);
		},

		async save(config: AppConfig): Promise<AppConfig> {
			const tempPath = `${configPath}.tmp`;
			await fsPromises.writeFile(tempPath, JSON.stringify(config, null, 2));
			await fsPromises.rename(tempPath, configPath);
			return config;
		},
	};
}

function getEnvOverrides(): Record<string, unknown> {
	const overrides: Record<string, unknown> = {};
	const prefix = "CONFIG_";

	for (const [envKey, envValue] of Object.entries(process.env)) {
		if (!envKey.startsWith(prefix) || envValue === undefined) {
			continue;
		}

		let currentSchemaNode = defaultAppConfig as any;
		let currentOverrideNode = overrides as any;
		let remainingKey = envKey
			.substring(prefix.length)
			.toUpperCase()
			.replace(/_/g, "");

		while (remainingKey.length > 0) {
			const keys = Object.keys(currentSchemaNode || {});
			const sortedKeys = keys.sort((a, b) => b.length - a.length);
			const matchingKey = sortedKeys.find((k) =>
				remainingKey.startsWith(k.toUpperCase()),
			);

			if (!matchingKey) {
				break;
			}

			if (remainingKey.length === matchingKey.length) {
				try {
					currentOverrideNode[matchingKey] = JSON.parse(envValue);
				} catch {
					currentOverrideNode[matchingKey] = envValue;
				}
				break;
			}

			remainingKey = remainingKey.substring(matchingKey.length);
			if (!currentOverrideNode[matchingKey]) {
				currentOverrideNode[matchingKey] = {};
			}
			currentOverrideNode = currentOverrideNode[matchingKey];
			currentSchemaNode = currentSchemaNode[matchingKey];
		}
	}
	return overrides;
}
