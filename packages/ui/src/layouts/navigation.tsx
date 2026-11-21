import { Link, useLocation } from "@tanstack/solid-router";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { SidebarMenuButton, SidebarMenuItem } from "../sidebar";
import {
	BriefcaseBusiness,
	ChartColumn,
	Clock3,
	Library,
	Settings,
} from "../workspace/icons";

export const NAVIGATION_ITEMS = [
	{
		icon: Library,
		labelKey: "navigation.library",
		shortcutId: "goLibrary",
		to: "/search",
	},
	{
		icon: BriefcaseBusiness,
		labelKey: "navigation.manager",
		shortcutId: "goManager",
		to: "/manager",
	},
	{
		icon: ChartColumn,
		labelKey: "navigation.statistics",
		shortcutId: undefined,
		to: "/statistics",
	},
	{
		icon: Clock3,
		labelKey: "navigation.jobs",
		shortcutId: "goJobs",
		to: "/jobs",
	},
	{
		icon: Settings,
		labelKey: "navigation.settings",
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
		<SidebarMenuItem>
			<SidebarMenuButton
				aria-current={active() ? "page" : undefined}
				aria-label={props.label}
				as={Link}
				class={
					props.expanded
						? "h-11 px-3 font-medium text-muted-foreground md:h-10"
						: "h-11 justify-center px-0 font-medium text-muted-foreground md:h-10"
				}
				isActive={active()}
				onClick={props.onClick}
				tooltip={props.expanded ? undefined : props.label}
				to={props.to}
			>
				<Icon aria-hidden="true" class="shrink-0" size={18} />
				<Show when={props.expanded}>
					<span class="min-w-0 flex-1 truncate">{props.label}</span>
					{props.children}
				</Show>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}
