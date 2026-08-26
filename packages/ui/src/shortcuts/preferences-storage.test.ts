import { describe, expect, it } from "vitest";

import { DEFAULT_SHORTCUT_BINDINGS, SHORTCUT_DEFINITIONS } from "./definitions";
import {
	findShortcutConflict,
	normalizeShortcutBinding,
	parseShortcutBinding,
	parseShortcutPreferencesPayload,
	parseStoredShortcutPreferences,
	SHORTCUT_PREFERENCES_VERSION,
	serializeShortcutPreferences,
} from "./preferences-storage";

describe("shortcut preference storage", () => {
	it("parses a versioned payload and merges missing defaults", () => {
		const bindings = parseStoredShortcutPreferences(
			JSON.stringify({
				version: SHORTCUT_PREFERENCES_VERSION,
				bindings: {
					commandPalette: "ctrl+shift+p",
					focusSearch: null,
				},
			}),
			"windows",
		);

		expect(bindings.commandPalette).toBe("Mod+Shift+P");
		expect(bindings.focusSearch).toBeNull();
		expect(bindings.goJobs).toBe(DEFAULT_SHORTCUT_BINDINGS.goJobs);
	});

	it("migrates v0 shortcuts and unversioned binding records", () => {
		const versionZero = parseShortcutPreferencesPayload(
			{
				version: 0,
				shortcuts: { toggleSidebar: "Control+Shift+B" },
			},
			"windows",
		);
		const unversioned = parseShortcutPreferencesPayload(
			{ viewGrid: "G" },
			"linux",
		);

		expect(versionZero.toggleSidebar).toBe("Mod+Shift+B");
		expect(unversioned.viewGrid).toBe("G");
		expect(unversioned.viewList).toBe(DEFAULT_SHORTCUT_BINDINGS.viewList);
	});

	it("falls back to defaults for malformed payloads and invalid bindings", () => {
		expect(parseStoredShortcutPreferences("{broken json")).toEqual(
			DEFAULT_SHORTCUT_BINDINGS,
		);
		expect(
			parseShortcutPreferencesPayload({
				version: 1,
				bindings: {
					commandPalette: 42,
					focusSearch: "",
					viewGrid: "NotARealKey",
				},
			}),
		).toEqual(DEFAULT_SHORTCUT_BINDINGS);
		expect(
			parseShortcutPreferencesPayload({ version: 999, bindings: {} }),
		).toEqual(DEFAULT_SHORTCUT_BINDINGS);
	});

	it("serializes the current schema version", () => {
		const serialized = serializeShortcutPreferences(DEFAULT_SHORTCUT_BINDINGS);
		const parsed: unknown = JSON.parse(serialized);

		expect(parsed).toEqual({
			version: SHORTCUT_PREFERENCES_VERSION,
			bindings: DEFAULT_SHORTCUT_BINDINGS,
		});
	});
});

describe("shortcut normalization and conflicts", () => {
	it("normalizes aliases using the selected platform", () => {
		expect(normalizeShortcutBinding("Control+K", "windows")).toBe("Mod+K");
		expect(normalizeShortcutBinding("Meta+K", "mac")).toBe("Mod+K");
		expect(parseShortcutBinding("shift+control+k", "windows")).toEqual({
			valid: true,
			binding: "Mod+Shift+K",
		});
	});

	it("finds normalized conflicts in the same application scope", () => {
		const conflict = findShortcutConflict(
			DEFAULT_SHORTCUT_BINDINGS,
			"commandPalette",
			"Control+B",
			"windows",
		);

		expect(conflict).toEqual({
			shortcutId: "toggleSidebar",
			label: SHORTCUT_DEFINITIONS.toggleSidebar.label,
			binding: "Mod+B",
		});
	});

	it("ignores the edited shortcut and disabled candidates", () => {
		expect(
			findShortcutConflict(
				DEFAULT_SHORTCUT_BINDINGS,
				"commandPalette",
				"Mod+K",
			),
		).toBeNull();
		expect(
			findShortcutConflict(DEFAULT_SHORTCUT_BINDINGS, "commandPalette", null),
		).toBeNull();
	});
});
