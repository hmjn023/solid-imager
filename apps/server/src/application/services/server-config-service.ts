import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { IConfigService } from "@solid-imager/core";
import {
	type AppConfig,
	AppConfigSchema,
	defaultAppConfig,
} from "@solid-imager/core/domain/config/config-schema";
import { logger } from "~/infrastructure/logger";

type ConfigChangeListener = (config: AppConfig) => void;

export class ServerConfigService implements IConfigService {
	private config: AppConfig;
	private readonly configPath: string;
	private listeners: ConfigChangeListener[] = [];

	constructor() {
		this.configPath = path.resolve(process.cwd(), "config.json");
		this.config = defaultAppConfig;
	}

	/**
	 * Synchronously loads the configuration from disk.
	 * If the file does not exist, it creates it with default values.
	 * Applies environment variable overrides.
	 */
	load(): void {
		try {
			let fileContent: unknown = {};

			if (fs.existsSync(this.configPath)) {
				try {
					const raw = fs.readFileSync(this.configPath, "utf-8");
					fileContent = JSON.parse(raw);
				} catch (error) {
					logger.fatal(
						{ err: error, path: this.configPath },
						"Failed to parse config.json. The file might be corrupted.",
					);
					throw new Error(
						`Configuration file at ${this.configPath} is corrupted: ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
				}

				const parsedFromFile = AppConfigSchema.safeParse(fileContent);
				if (parsedFromFile.success) {
					// unknown フィールドを保持しつつ新しいスキーマデフォルトをマージ。
					// safeParse はスキーマ外フィールドを除去するため、直接比較すると
					// ユーザーが手動追加したフィールドが原因で常に不一致となる。
					const merged = this.deepMerge(fileContent, parsedFromFile.data);
					if (!isDeepStrictEqual(merged, fileContent)) {
						fs.writeFileSync(this.configPath, JSON.stringify(merged, null, 2));
						logger.info("config.json migrated with new default fields");
					}
					fileContent = merged;
				}
			} else {
				logger.info("config.json not found, creating default");
				// For init, we can write sync.
				fs.writeFileSync(
					this.configPath,
					JSON.stringify(defaultAppConfig, null, 2),
				);
				fileContent = defaultAppConfig;
			}

			// Apply Env Overrides
			const envOverrides = this.getEnvOverrides();
			const mergedConfig = this.deepMerge(fileContent, envOverrides);

			// Validate and Fix
			const result = AppConfigSchema.safeParse(mergedConfig);

			if (result.success) {
				this.config = result.data;
			} else {
				logger.error(
					{ errors: result.error.format() },
					"Invalid configuration detected. Using fallback/defaults where possible.",
				);
				throw new Error(
					`Invalid configuration: ${JSON.stringify(result.error.format())}`,
				);
			}

			logger.debug({ config: this.config }, "Configuration loaded");
		} catch (error) {
			logger.fatal({ err: error }, "Failed to load configuration");
			throw error;
		}
	}

	getConfig(): AppConfig {
		return this.config;
	}

	async updateConfig(newConfig: Partial<AppConfig>): Promise<void> {
		const merged = this.deepMerge(this.config, newConfig);

		const result = AppConfigSchema.safeParse(merged);
		if (!result.success) {
			throw new Error(
				`Invalid configuration update: ${JSON.stringify(result.error.format())}`,
			);
		}

		const validatedConfig = result.data;

		await this.saveToDisk(validatedConfig);

		this.config = validatedConfig;

		this.notifyListeners();
	}

	onChange(listener: ConfigChangeListener): () => void {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		};
	}

	private notifyListeners() {
		for (const listener of this.listeners) {
			try {
				listener(this.config);
			} catch (error) {
				logger.error({ err: error }, "Error in config listener");
			}
		}
	}

	private async saveToDisk(config: AppConfig): Promise<void> {
		const tempPath = `${this.configPath}.tmp`;
		await fsPromises.writeFile(tempPath, JSON.stringify(config, null, 2));
		await fsPromises.rename(tempPath, this.configPath);
	}

	private getEnvOverrides(): Record<string, unknown> {
		const overrides: Record<string, unknown> = {};
		const prefix = "CONFIG_";

		for (const [envKey, envValue] of Object.entries(process.env)) {
			if (!envKey.startsWith(prefix) || envValue === undefined) {
				continue;
			}

			let currentSchemaNode = defaultAppConfig as any;
			let currentOverrideNode = overrides as any;
			// CONFIG_AI_BASE_URL -> AIBASEURL
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

	private deepMerge(target: any, source: any): any {
		if (
			typeof target !== "object" ||
			target === null ||
			typeof source !== "object" ||
			source === null
		) {
			return source;
		}

		if (Array.isArray(source)) {
			return source;
		}

		const output = { ...target };
		for (const key of Object.keys(source)) {
			if (Object.hasOwn(source, key)) {
				if (Object.hasOwn(target, key)) {
					output[key] = this.deepMerge(target[key], source[key]);
				} else {
					output[key] = source[key];
				}
			}
		}
		return output;
	}
}
