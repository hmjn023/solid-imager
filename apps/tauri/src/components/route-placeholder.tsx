import type { JSX } from "solid-js";

interface RoutePlaceholderProps {
	title: string;
	description: string;
	actions?: JSX.Element;
}

export function RoutePlaceholder(props: RoutePlaceholderProps) {
	return (
		<section class="grid gap-6">
			<div class="grid gap-3">
				<p class="font-medium text-sky-700 text-sm uppercase tracking-[0.3em]">
					Issue 219
				</p>
				<div class="grid gap-2">
					<h1 class="font-semibold text-4xl tracking-tight">{props.title}</h1>
					<p class="max-w-3xl text-lg text-muted-foreground">
						{props.description}
					</p>
				</div>
			</div>
			<div class="rounded-xl border border-dashed border-border bg-card/60 p-6 shadow-sm">
				<p class="text-muted-foreground text-sm">
					This route scaffold is now in the standalone Tauri SPA tree. The
					server page implementation will be ported here in follow-up commits.
				</p>
				{props.actions ? <div class="mt-4">{props.actions}</div> : null}
			</div>
		</section>
	);
}
