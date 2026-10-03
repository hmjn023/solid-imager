import type { JSX } from "solid-js";
import { Show } from "solid-js";

type ManagementHeaderProps = {
	actions?: JSX.Element;
	description: string;
	eyebrow?: string;
	title: string;
};

export function ManagementHeader(props: ManagementHeaderProps) {
	return (
		<header class="shrink-0 border-border border-b bg-card px-4 py-3 sm:px-6">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<p class="font-medium text-xs text-primary">
						{props.eyebrow ?? "Workspace"}
					</p>
					<h1 class="mt-0.5 font-semibold text-xl text-foreground">
						{props.title}
					</h1>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{props.description}
					</p>
				</div>
				<Show when={props.actions}>
					<div class="shrink-0">{props.actions}</div>
				</Show>
			</div>
		</header>
	);
}

export const CATEGORY_TABS_CLASS =
	"min-h-11 shrink-0 gap-2.5 rounded-md px-2.5 text-muted-foreground shadow-none data-[selected]:bg-accent data-[selected]:text-primary lg:min-h-10 lg:w-full lg:justify-start";

export function categoryButtonClass(active: boolean): string {
	return `flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${
		active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted"
	}`;
}

export function CategoryLabel(props: {
	description: string;
	icon: JSX.Element;
	label: string;
	responsiveDescription?: "lg" | "md";
}) {
	const descriptionBreakpoint = () =>
		props.responsiveDescription === "md" ? "md:block" : "lg:block";
	return (
		<>
			<span class="shrink-0">{props.icon}</span>
			<span class="min-w-0 text-left">
				<strong class="block truncate font-medium text-sm">
					{props.label}
				</strong>
				<span
					class={`hidden truncate text-label-sm text-muted-foreground ${descriptionBreakpoint()}`}
				>
					{props.description}
				</span>
			</span>
		</>
	);
}
