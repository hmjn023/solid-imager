import { t } from "@solid-imager/i18n";
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
		label: t("definitions.commandPalette"),
		description: t("definitions.findAndRunAnActionFromAnywhereInThe"),
		group: "General",
		scope: "application",
		defaultBinding: "Mod+K",
	},
	shortcutHelp: {
		id: "shortcutHelp",
		label: t("definitions.keyboardShortcutHelp"),
		description: t("definitions.openTheKeyboardShortcutReference"),
		group: "General",
		scope: "application",
		defaultBinding: "Mod+/",
	},
	focusSearch: {
		id: "focusSearch",
		label: t("definitions.focusSearch"),
		description: t("definitions.moveFocusToThePrimaryMediaSearchField"),
		group: "General",
		scope: "application",
		defaultBinding: "/",
	},
	toggleSidebar: {
		id: "toggleSidebar",
		label: t("definitions.toggleSidebar"),
		description: t("definitions.expandOrCollapseTheApplicationSidebar"),
		group: "General",
		scope: "application",
		defaultBinding: "Mod+B",
	},
	goLibrary: {
		id: "goLibrary",
		label: t("definitions.goToLibrary"),
		description: t("definitions.openTheMediaLibrary"),
		group: "Navigation",
		scope: "application",
		defaultBinding: "Mod+1",
	},
	goManager: {
		id: "goManager",
		label: t("definitions.goToManager"),
		description: t("definitions.openMediaManagementTools"),
		group: "Navigation",
		scope: "application",
		defaultBinding: "Mod+2",
	},
	goJobs: {
		id: "goJobs",
		label: t("definitions.goToJobs"),
		description: t("definitions.openBackgroundJobActivity"),
		group: "Navigation",
		scope: "application",
		defaultBinding: "Mod+3",
	},
	goSettings: {
		id: "goSettings",
		label: t("definitions.goToSettings"),
		description: t("definitions.openApplicationSettings"),
		group: "Navigation",
		scope: "application",
		defaultBinding: "Mod+,",
	},
	viewGrid: {
		id: "viewGrid",
		label: t("actions.gridView"),
		description: t("definitions.showMediaInAVisualGrid"),
		group: "View",
		scope: "application",
		defaultBinding: "1",
	},
	viewList: {
		id: "viewList",
		label: t("actions.listView"),
		description: t("definitions.showMediaInACompactList"),
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

export function shortcutGroupLabel(group: ShortcutGroup): string {
	const keys = {
		General: "labels.general",
		Navigation: "shortcuts.group.navigation",
		View: "shortcuts.group.view",
	} as const;
	return t(keys[group]);
}
