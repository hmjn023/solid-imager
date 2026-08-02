import type { JSX } from "solid-js";
import { Show } from "solid-js";

type V2ManagementHeaderProps = {
	actions?: JSX.Element;
	description: string;
	eyebrow?: string;
	title: string;
};

export function V2ManagementHeader(props: V2ManagementHeaderProps) {
	return (
		<header class="shrink-0 border-[var(--v2-border)] border-b bg-[var(--v2-surface)] px-4 py-3 sm:px-6">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<p class="font-medium text-xs text-[var(--v2-primary)]">
						{props.eyebrow ?? "Workspace"}
					</p>
					<h1 class="mt-0.5 font-semibold text-xl text-[var(--v2-text)]">
						{props.title}
					</h1>
					<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
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

export const V2_CATEGORY_TABS_CLASS =
	"min-h-11 shrink-0 gap-2.5 rounded-md px-2.5 text-[var(--v2-text-secondary)] shadow-none data-[selected]:bg-[var(--v2-surface-selected)] data-[selected]:text-[var(--v2-primary)] lg:min-h-10 lg:w-full lg:justify-start";

export function v2CategoryButtonClass(active: boolean): string {
	return `flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)] ${
		active
			? "bg-[var(--v2-surface-selected)] text-[var(--v2-primary)]"
			: "text-[var(--v2-text-secondary)] hover:bg-[var(--v2-surface-muted)]"
	}`;
}

export function V2CategoryLabel(props: {
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
					class={`hidden truncate text-[11px] text-[var(--v2-text-muted)] ${descriptionBreakpoint()}`}
				>
					{props.description}
				</span>
			</span>
		</>
	);
}
