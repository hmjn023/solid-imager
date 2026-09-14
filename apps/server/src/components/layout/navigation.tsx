import {
	BriefcaseBusiness,
	Clock3,
	Library,
	Settings,
} from "@solid-imager/ui/workspace/icons";
import { Link, useLocation } from "@tanstack/solid-router";
import type { JSX } from "solid-js";
import { Show } from "solid-js";

export const NAVIGATION_ITEMS = [
	{
		icon: Library,
		label: "Library",
		shortcutId: "goLibrary",
		to: "/search",
	},
	{
		icon: BriefcaseBusiness,
		label: "Manager",
		shortcutId: "goManager",
		to: "/manager",
	},
	{ icon: Clock3, label: "Jobs", shortcutId: "goJobs", to: "/jobs" },
	{
		icon: Settings,
		label: "Settings",
		shortcutId: "goSettings",
		to: "/config",
	},
] as const;

export function NavigationItem(props: {
	children?: JSX.Element;
	expanded: boolean;
	icon: typeof Library;
	label: string;
	onClick?: () => void;
	to: string;
}) {
	const location = useLocation();
	const active = () =>
		location().pathname === props.to ||
		(props.to !== "/search" && location().pathname.startsWith(`${props.to}/`));
	const Icon = props.icon;

	return (
		<Link
			aria-current={active() ? "page" : undefined}
			aria-label={props.label}
			class={`flex h-11 w-full items-center gap-2 rounded-md px-3 font-medium text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--workspace-focus)] md:h-10 ${
				active()
					? "bg-[var(--workspace-surface-selected)] text-[var(--workspace-primary)]"
					: "text-[var(--workspace-text-secondary)] hover:bg-[var(--workspace-surface-muted)] hover:text-[var(--workspace-text)]"
			}`}
			onClick={props.onClick}
			to={props.to}
		>
			<Icon aria-hidden="true" class="shrink-0" size={18} />
			<Show when={props.expanded}>
				<span class="min-w-0 flex-1 truncate">{props.label}</span>
				{props.children}
			</Show>
		</Link>
	);
}
