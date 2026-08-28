import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";

const IMPORT_SOURCE_PREFERENCE_KEY = "solid-imager:import-source-preference";

type StoredImportSourcePreference = {
	remember: boolean;
	sourceId?: string;
};

function getStorage(): Storage | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

function readPreference(): StoredImportSourcePreference {
	const storage = getStorage();
	if (!storage) {
		return { remember: false };
	}

	try {
		const value = storage.getItem(IMPORT_SOURCE_PREFERENCE_KEY);
		if (!value) {
			return { remember: false };
		}

		const parsed: unknown = JSON.parse(value);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			typeof (parsed as Record<string, unknown>).remember !== "boolean"
		) {
			return { remember: false };
		}

		const record = parsed as Record<string, unknown>;
		return {
			remember: record.remember,
			sourceId: typeof record.sourceId === "string" ? record.sourceId : undefined,
		};
	} catch {
		return { remember: false };
	}
}

export function getRememberedImportSourceId(
	sources: readonly SafeMediaSource[],
): string | null {
	const preference = readPreference();
	if (!preference.remember || !preference.sourceId) {
		return null;
	}

	return sources.some((source) => source.id === preference.sourceId)
		? preference.sourceId
		: null;
}

export function isImportSourceRemembered(): boolean {
	return readPreference().remember;
}

export function setImportSourcePreference(
	remember: boolean,
	sourceId?: string,
): void {
	const storage = getStorage();
	if (!storage) {
		return;
	}

	try {
		if (!remember || !sourceId) {
			storage.removeItem(IMPORT_SOURCE_PREFERENCE_KEY);
			return;
		}

		storage.setItem(
			IMPORT_SOURCE_PREFERENCE_KEY,
			JSON.stringify({ remember: true, sourceId }),
		);
	} catch {
		// Ignore unavailable or quota-limited browser storage.
	}
}
