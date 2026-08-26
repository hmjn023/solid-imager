import {
	BriefcaseBusiness,
	Clock3,
	Library,
	Settings,
} from "@solid-imager/ui/v2/icons";
import { Link, useLocation } from "@tanstack/solid-router";
import type { JSX } from "solid-js";
import { Show } from "solid-js";

export const V2_NAVIGATION_ITEMS = [
	{
		icon: Library,
		label: "Library",
		shortcutId: "goLibrary",
		to: "/v2/search",
	},
	{
		icon: BriefcaseBusiness,
		label: "Manager",
		shortcutId: "goManager",
		to: "/v2/manager",
	},
	{ icon: Clock3, label: "Jobs", shortcutId: "goJobs", to: "/v2/jobs" },
	{
		icon: Settings,
		label: "Settings",
		shortcutId: "goSettings",
		to: "/v2/config",
	},
] as const;

export function V2NavigationItem(props: {
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
		(props.to !== "/v2/search" &&
			location().pathname.startsWith(`${props.to}/`));
	const Icon = props.icon;

	return (
		<Link
			aria-current={active() ? "page" : undefined}
			aria-label={props.label}
			class={`flex h-11 w-full items-center gap-2 rounded-md px-3 font-medium text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)] md:h-10 ${
				active()
					? "bg-[var(--v2-surface-selected)] text-[var(--v2-primary)]"
					: "text-[var(--v2-text-secondary)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text)]"
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
