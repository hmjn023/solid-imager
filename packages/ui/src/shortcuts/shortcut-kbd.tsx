import { detectPlatform, formatForDisplay } from "@tanstack/solid-hotkeys";
import { type Accessor, createSignal, type JSX, onMount } from "solid-js";

import { cn } from "../utils/cn";
import type { ShortcutBinding, ShortcutId } from "./definitions";
import { useShortcutPreferences } from "./preferences-provider";
import type { ShortcutPlatform } from "./preferences-storage";

export interface ShortcutKbdProps {
	readonly shortcutId?: ShortcutId;
	readonly binding?: ShortcutBinding;
	readonly class?: string;
	readonly disabledLabel?: string;
}

export function createShortcutDisplayPlatform(): Accessor<ShortcutPlatform> {
	const [platform, setPlatform] = createSignal<ShortcutPlatform>("linux");
	onMount(() => setPlatform(detectPlatform()));
	return platform;
}

export function ShortcutKbd(props: ShortcutKbdProps): JSX.Element {
	const preferences = useShortcutPreferences();
	const platform = createShortcutDisplayPlatform();
	const disabledLabel = (): string => props.disabledLabel ?? "Disabled";
	const binding = (): ShortcutBinding => {
		if (props.binding !== undefined) {
			return props.binding;
		}
		return props.shortcutId === undefined
			? null
			: preferences.getBinding(props.shortcutId);
	};
	const displayValue = (): string => {
		const currentBinding = binding();
		return currentBinding === null
			? "—"
			: formatForDisplay(currentBinding, { platform: platform() });
	};
	const accessibleValue = (): string => {
		const currentBinding = binding();
		return currentBinding === null
			? disabledLabel()
			: formatForDisplay(currentBinding, {
					platform: platform(),
					useSymbols: false,
				});
	};

	return (
		<kbd
			aria-label={accessibleValue()}
			class={cn(
				"inline-flex min-h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-medium font-mono text-[0.6875rem] text-muted-foreground shadow-sm",
				props.class,
			)}
		>
			{displayValue()}
		</kbd>
	);
}
