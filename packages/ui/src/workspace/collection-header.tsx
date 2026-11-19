import type { JSX, ParentProps } from "solid-js";

export function CollectionHeader(
	props: ParentProps<{ heading: JSX.Element; summary?: JSX.Element }>,
) {
	return (
		<header class="shrink-0 border-border border-b bg-background px-3 py-3 sm:px-4">
			<div class="mb-2 flex min-h-6 items-center gap-2 text-sm">
				{props.heading}
				{props.summary}
			</div>
			{props.children}
		</header>
	);
}
