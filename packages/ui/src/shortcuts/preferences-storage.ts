import {
	type Hotkey,
	normalizeHotkey,
	validateHotkey,
} from "@tanstack/solid-hotkeys";

import {
	DEFAULT_SHORTCUT_BINDINGS,
	getShortcutDefinition,
	SHORTCUT_DEFINITION_LIST,
	type ShortcutBinding,
	type ShortcutBindings,
	type ShortcutId,
} from "./definitions";

export const SHORTCUT_PREFERENCES_STORAGE_KEY =
	"solid-imager:shortcut-preferences:v1";
export const SHORTCUT_PREFERENCES_VERSION = 1;

export type ShortcutPlatform = "mac" | "windows" | "linux";

export interface ShortcutConflict {
	readonly shortcutId: ShortcutId;
	readonly label: string;
	readonly binding: Hotkey;
}

export type ShortcutBindingParseResult =
	| {
			readonly valid: true;
			readonly binding: ShortcutBinding;
	  }
	| {
			readonly valid: false;
			readonly messages: readonly string[];
	  };

interface StoredShortcutPreferencesV1 {
	readonly version: 1;
	readonly bindings: ShortcutBindings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStoredBindingSource(
	payload: unknown,
): Record<string, unknown> | null {
	if (!isRecord(payload)) {
		return null;
	}

	if (payload.version === SHORTCUT_PREFERENCES_VERSION) {
		return isRecord(payload.bindings) ? payload.bindings : null;
	}

	if (payload.version === 0) {
		if (isRecord(payload.shortcuts)) {
			return payload.shortcuts;
		}
		return isRecord(payload.bindings) ? payload.bindings : null;
	}

	if (Object.hasOwn(payload, "version")) {
		return null;
	}

	if (isRecord(payload.bindings)) {
		return payload.bindings;
	}

	return payload;
}

export function normalizeShortcutBinding(
	binding: Hotkey,
	platform: ShortcutPlatform = "linux",
): Hotkey {
	return normalizeHotkey(binding, platform);
}

export function parseShortcutBinding(
	value: unknown,
	platform: ShortcutPlatform = "linux",
): ShortcutBindingParseResult {
	if (value === null) {
		return { valid: true, binding: null };
	}

	if (typeof value !== "string") {
		return {
			valid: false,
			messages: ["Shortcut binding must be a string or null."],
		};
	}

	const validation = validateHotkey(value);
	if (!validation.valid || validation.warnings.length > 0) {
		return {
			valid: false,
			messages: [...validation.errors, ...validation.warnings],
		};
	}

	return {
		valid: true,
		binding: normalizeHotkey(value, platform),
	};
}

function readStoredBinding(
	source: Record<string, unknown>,
	id: ShortcutId,
	platform: ShortcutPlatform,
): ShortcutBinding {
	if (!Object.hasOwn(source, id)) {
		return DEFAULT_SHORTCUT_BINDINGS[id];
	}

	const parsed = parseShortcutBinding(source[id], platform);
	return parsed.valid ? parsed.binding : DEFAULT_SHORTCUT_BINDINGS[id];
}

export function parseShortcutPreferencesPayload(
	payload: unknown,
	platform: ShortcutPlatform = "linux",
): ShortcutBindings {
	const source = getStoredBindingSource(payload);
	if (source === null) {
		return DEFAULT_SHORTCUT_BINDINGS;
	}

	return {
		commandPalette: readStoredBinding(source, "commandPalette", platform),
		shortcutHelp: readStoredBinding(source, "shortcutHelp", platform),
		focusSearch: readStoredBinding(source, "focusSearch", platform),
		toggleSidebar: readStoredBinding(source, "toggleSidebar", platform),
		goLibrary: readStoredBinding(source, "goLibrary", platform),
		goManager: readStoredBinding(source, "goManager", platform),
		goJobs: readStoredBinding(source, "goJobs", platform),
		goSettings: readStoredBinding(source, "goSettings", platform),
		viewGrid: readStoredBinding(source, "viewGrid", platform),
		viewList: readStoredBinding(source, "viewList", platform),
	};
}

export function parseStoredShortcutPreferences(
	serialized: string | null,
	platform: ShortcutPlatform = "linux",
): ShortcutBindings {
	if (serialized === null) {
		return DEFAULT_SHORTCUT_BINDINGS;
	}

	try {
		const payload: unknown = JSON.parse(serialized);
		return parseShortcutPreferencesPayload(payload, platform);
	} catch {
		return DEFAULT_SHORTCUT_BINDINGS;
	}
}

export function serializeShortcutPreferences(
	bindings: ShortcutBindings,
): string {
	const payload: StoredShortcutPreferencesV1 = {
		version: SHORTCUT_PREFERENCES_VERSION,
		bindings,
	};
	const serialized = JSON.stringify(payload);
	return typeof serialized === "string" ? serialized : "";
}

export function findShortcutConflict(
	bindings: ShortcutBindings,
	shortcutId: ShortcutId,
	candidate: ShortcutBinding,
	platform: ShortcutPlatform = "linux",
): ShortcutConflict | null {
	if (candidate === null) {
		return null;
	}

	const definition = getShortcutDefinition(shortcutId);
	const normalizedCandidate = normalizeShortcutBinding(candidate, platform);

	for (const otherDefinition of SHORTCUT_DEFINITION_LIST) {
		if (
			otherDefinition.id === shortcutId ||
			otherDefinition.scope !== definition.scope
		) {
			continue;
		}

		const otherBinding = bindings[otherDefinition.id];
		if (
			otherBinding !== null &&
			normalizeShortcutBinding(otherBinding, platform) === normalizedCandidate
		) {
			return {
				shortcutId: otherDefinition.id,
				label: otherDefinition.label,
				binding: normalizedCandidate,
			};
		}
	}

	return null;
}

export function hasCustomShortcutBindings(
	bindings: ShortcutBindings,
	platform: ShortcutPlatform = "linux",
): boolean {
	return SHORTCUT_DEFINITION_LIST.some((definition) => {
		const binding = bindings[definition.id];
		return (
			binding === null ||
			normalizeShortcutBinding(binding, platform) !==
				normalizeShortcutBinding(definition.defaultBinding, platform)
		);
	});
}
