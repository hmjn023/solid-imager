import {
	AppConfigSchema,
	defaultAppConfig,
} from "@solid-imager/core/domain/config/config-schema";
import {
	mediaSourceInfoSchema,
	safeMediaSourceSchema,
	type SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { z } from "zod";

const FALLBACK_SOURCES_KEY = "solid-imager.tauri.fallback-sources";
const FALLBACK_CONFIG_KEY = "solid-imager.tauri.fallback-config";

function readStorage<T>(key: string, schema: { safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: unknown } }): T | undefined {
	if (typeof localStorage === "undefined") return undefined;
	const raw = localStorage.getItem(key);
	if (!raw) return undefined;
	try {
		const data: unknown = JSON.parse(raw);
		const result = schema.safeParse(data);
		return result.success ? (result.data as T) : undefined;
	} catch {
		return undefined;
	}
}

function writeStorage(key: string, value: unknown) {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(key, JSON.stringify(value));
}

function mergeConfig(
	base: unknown,
	patch: unknown,
): unknown {
	if (
		base === null ||
		patch === null ||
		typeof base !== "object" ||
		typeof patch !== "object" ||
		Array.isArray(base) ||
		Array.isArray(patch)
	) {
		return patch ?? base;
	}
	const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
	for (const [key, value] of Object.entries(patch)) {
		result[key] = mergeConfig(result[key], value);
	}
	return result;
}

export function readFallbackConfig() {
	const stored = readStorage(FALLBACK_CONFIG_KEY, AppConfigSchema);
	return stored ?? defaultAppConfig;
}

export function updateFallbackConfig(patch: unknown) {
	const parsedPatch = AppConfigSchema.partial().parse(patch);
	const config = AppConfigSchema.parse(mergeConfig(readFallbackConfig(), parsedPatch));
	writeStorage(FALLBACK_CONFIG_KEY, config);
	return config;
}

const sourcesArrayValidator = {
	safeParse: (data: unknown) => {
		if (!Array.isArray(data)) return { success: false as const, error: new Error("Expected array") };
		const items: SafeMediaSource[] = [];
		for (const item of data) {
			const parsed = safeMediaSourceSchema.safeParse(item);
			if (!parsed.success) return { success: false as const, error: parsed.error };
			items.push(parsed.data);
		}
		return { success: true as const, data: items };
	},
};

export function readFallbackSources(): SafeMediaSource[] {
	return readStorage<SafeMediaSource[]>(FALLBACK_SOURCES_KEY, sourcesArrayValidator) ?? [];
}

function writeFallbackSources(sources: SafeMediaSource[]) {
	writeStorage(FALLBACK_SOURCES_KEY, sources);
}

export function createFallbackSource(input: unknown): SafeMediaSource {
	const data = mediaSourceInfoSchema.parse(input);
	const source = safeMediaSourceSchema.parse({
		...data,
		id: data.id ?? crypto.randomUUID(),
	});
	writeFallbackSources([...readFallbackSources(), source]);
	return source;
}

export function getFallbackSource(input: unknown): SafeMediaSource {
	const { id } = z.object({ id: z.string() }).parse(input);
	const source = readFallbackSources().find((s) => s.id === id);
	if (!source) throw new Error(`Source not found: ${id}`);
	return source;
}

export function updateFallbackSource(input: unknown): SafeMediaSource {
	const { id, data } = z.object({ id: z.string(), data: z.unknown() }).parse(input);
	const sources = readFallbackSources();
	const index = sources.findIndex((s) => s.id === id);
	if (index === -1) throw new Error(`Source not found: ${id}`);
	const patch = mediaSourceInfoSchema.partial().parse(data);
	const updated = safeMediaSourceSchema.parse({
		...sources[index],
		...patch,
		id,
		connectionInfo: patch.connectionInfo ?? sources[index].connectionInfo,
	});
	writeFallbackSources([
		...sources.slice(0, index),
		updated,
		...sources.slice(index + 1),
	]);
	return updated;
}

export function deleteFallbackSource(input: unknown): { success: true } {
	const { id } = z.object({ id: z.string() }).parse(input);
	writeFallbackSources(readFallbackSources().filter((s) => s.id !== id));
	return { success: true };
}
