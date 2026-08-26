import {
	type ConflictBehavior,
	createHotkey,
	type HotkeyCallback,
	type HotkeyMeta,
} from "@tanstack/solid-hotkeys";

import { getShortcutDefinition, type ShortcutId } from "./definitions";
import { useShortcutPreferences } from "./preferences-provider";

export interface AppShortcutOptions {
	readonly conflictBehavior?: ConflictBehavior;
	readonly enabled?: boolean;
	readonly eventType?: "keydown" | "keyup";
	readonly ignoreInputs?: boolean;
	readonly platform?: "mac" | "windows" | "linux";
	readonly preventDefault?: boolean;
	readonly requireReset?: boolean;
	readonly stopPropagation?: boolean;
	readonly target?: HTMLElement | Document | Window | null;
	readonly meta?: HotkeyMeta;
}

export type AppShortcutOptionsAccessor = () => AppShortcutOptions;

export function createAppShortcut(
	id: ShortcutId,
	callback: HotkeyCallback,
	options: AppShortcutOptions | AppShortcutOptionsAccessor = {},
): void {
	const preferences = useShortcutPreferences();
	const definition = getShortcutDefinition(id);

	createHotkey(
		() => preferences.getBinding(id) ?? definition.defaultBinding,
		callback,
		() => {
			const resolvedOptions =
				typeof options === "function" ? options() : options;
			const binding = preferences.getBinding(id);

			return {
				...resolvedOptions,
				enabled:
					resolvedOptions.enabled !== false &&
					binding !== null &&
					!preferences.isRecording() &&
					!preferences.isSuspended(),
				preventDefault: resolvedOptions.preventDefault ?? true,
				stopPropagation: resolvedOptions.stopPropagation ?? true,
				requireReset: resolvedOptions.requireReset ?? true,
				ignoreInputs: resolvedOptions.ignoreInputs ?? true,
				meta: {
					...resolvedOptions.meta,
					name: resolvedOptions.meta?.name ?? definition.label,
					description:
						resolvedOptions.meta?.description ?? definition.description,
				},
			};
		},
	);
}
