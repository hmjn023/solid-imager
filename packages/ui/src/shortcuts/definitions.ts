import type { Hotkey } from "@tanstack/solid-hotkeys";

export type ShortcutId =
	| "commandPalette"
	| "shortcutHelp"
	| "focusSearch"
	| "toggleSidebar"
	| "goLibrary"
	| "goManager"
	| "goJobs"
	| "goSettings"
	| "viewGrid"
	| "viewList";

export type ShortcutGroup = "General" | "Navigation" | "View";
export type ShortcutScope = "application";
export type ShortcutBinding = Hotkey | null;

export interface ShortcutDefinition {
	readonly id: ShortcutId;
	readonly label: string;
	readonly description: string;
	readonly group: ShortcutGroup;
	readonly scope: ShortcutScope;
	readonly defaultBinding: Hotkey;
}

export type ShortcutBindings = Readonly<Record<ShortcutId, ShortcutBinding>>;

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
	"General",
	"Navigation",
	"View",
];

export const SHORTCUT_DEFINITIONS = {
	commandPalette: {
		id: "commandPalette",
		label: "Command palette",
		description: "Find and run an action from anywhere in the app.",
		group: "General",
		scope: "application",
		defaultBinding: "Mod+K",
	},
	shortcutHelp: {
		id: "shortcutHelp",
		label: "Keyboard shortcut help",
		description: "Open the keyboard shortcut reference.",
		group: "General",
		scope: "application",
		defaultBinding: "Mod+/",
	},
	focusSearch: {
		id: "focusSearch",
		label: "Focus search",
		description: "Move focus to the primary media search field.",
		group: "General",
		scope: "application",
		defaultBinding: "/",
	},
	toggleSidebar: {
		id: "toggleSidebar",
		label: "Toggle sidebar",
		description: "Expand or collapse the application sidebar.",
		group: "General",
		scope: "application",
		defaultBinding: "Mod+B",
	},
	goLibrary: {
		id: "goLibrary",
		label: "Go to Library",
		description: "Open the media library.",
		group: "Navigation",
		scope: "application",
		defaultBinding: "Mod+1",
	},
	goManager: {
		id: "goManager",
		label: "Go to Manager",
		description: "Open media management tools.",
		group: "Navigation",
		scope: "application",
		defaultBinding: "Mod+2",
	},
	goJobs: {
		id: "goJobs",
		label: "Go to Jobs",
		description: "Open background job activity.",
		group: "Navigation",
		scope: "application",
		defaultBinding: "Mod+3",
	},
	goSettings: {
		id: "goSettings",
		label: "Go to Settings",
		description: "Open application settings.",
		group: "Navigation",
		scope: "application",
		defaultBinding: "Mod+,",
	},
	viewGrid: {
		id: "viewGrid",
		label: "Grid view",
		description: "Show media in a visual grid.",
		group: "View",
		scope: "application",
		defaultBinding: "1",
	},
	viewList: {
		id: "viewList",
		label: "List view",
		description: "Show media in a compact list.",
		group: "View",
		scope: "application",
		defaultBinding: "2",
	},
} satisfies Record<ShortcutId, ShortcutDefinition>;

export const SHORTCUT_DEFINITION_LIST: readonly ShortcutDefinition[] =
	Object.values(SHORTCUT_DEFINITIONS);

export const DEFAULT_SHORTCUT_BINDINGS: ShortcutBindings = {
	commandPalette: SHORTCUT_DEFINITIONS.commandPalette.defaultBinding,
	shortcutHelp: SHORTCUT_DEFINITIONS.shortcutHelp.defaultBinding,
	focusSearch: SHORTCUT_DEFINITIONS.focusSearch.defaultBinding,
	toggleSidebar: SHORTCUT_DEFINITIONS.toggleSidebar.defaultBinding,
	goLibrary: SHORTCUT_DEFINITIONS.goLibrary.defaultBinding,
	goManager: SHORTCUT_DEFINITIONS.goManager.defaultBinding,
	goJobs: SHORTCUT_DEFINITIONS.goJobs.defaultBinding,
	goSettings: SHORTCUT_DEFINITIONS.goSettings.defaultBinding,
	viewGrid: SHORTCUT_DEFINITIONS.viewGrid.defaultBinding,
	viewList: SHORTCUT_DEFINITIONS.viewList.defaultBinding,
};

export function getShortcutDefinition(id: ShortcutId): ShortcutDefinition {
	return SHORTCUT_DEFINITIONS[id];
}

export function getShortcutDefinitionsForGroup(
	group: ShortcutGroup,
): readonly ShortcutDefinition[] {
	return SHORTCUT_DEFINITION_LIST.filter(
		(definition) => definition.group === group,
	);
}
