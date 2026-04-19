import {
	type AppConfig,
	AppConfigSchema,
} from "@solid-imager/core/domain/config/config-schema";
import { AppConfigRepository } from "../repositories/app-config-repository";

type ConfigListener = (config: AppConfig) => void;

function deepMerge<T>(base: T, patch: Partial<T>): T {
	if (
		base === null ||
		patch === null ||
		typeof base !== "object" ||
		typeof patch !== "object" ||
		Array.isArray(base) ||
		Array.isArray(patch)
	) {
		return (patch as T) ?? base;
	}

	const result: Record<string, unknown> = {
		...(base as Record<string, unknown>),
	};
	for (const [key, value] of Object.entries(patch)) {
		if (value === undefined) {
			continue;
		}
		const current = result[key];
		result[key] =
			current &&
			value &&
			typeof current === "object" &&
			typeof value === "object" &&
			!Array.isArray(current) &&
			!Array.isArray(value)
				? deepMerge(
						current as Record<string, unknown>,
						value as Record<string, unknown>,
					)
				: value;
	}
	return result as T;
}

class TauriConfigServiceImpl {
	private listeners = new Set<ConfigListener>();

	async getConfig(): Promise<AppConfig> {
		return await AppConfigRepository.get();
	}

	async updateConfig(input: Partial<AppConfig>): Promise<AppConfig> {
		const current = await this.getConfig();
		const merged = AppConfigSchema.parse(deepMerge(current, input));
		const saved = await AppConfigRepository.save(merged);
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

export const TauriConfigService = new TauriConfigServiceImpl();
