import { createFileRoute } from "@tanstack/solid-router";

const phaseItems = [
	"Remove remaining `isServer` assumptions outside `apps/server`.",
	"Add IPC-backed infrastructure under `src/infrastructure/tauri`.",
	"Port UI routes from `apps/server/src/routes` into this SPA tree.",
];

export const Route = createFileRoute("/")({
	component: HomeRoute,
});

function HomeRoute() {
	return (
		<section class="grid gap-6">
			<div class="grid gap-3">
				<p class="font-medium text-sky-700 text-sm uppercase tracking-[0.3em]">
					Phase 2
				</p>
				<div class="grid gap-2">
					<h1 class="font-semibold text-4xl tracking-tight">
						Tauri SPA scaffold
					</h1>
					<p class="max-w-2xl text-lg text-muted-foreground">
						This app is the new standalone client boundary for the desktop
						runtime. Nitro and TanStack Start stay in `apps/server`; Tauri UI
						moves here.
					</p>
				</div>
			</div>
			<div class="grid gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
				<h2 class="font-medium text-xl">Next steps</h2>
				<ul class="grid gap-3 text-muted-foreground">
					{phaseItems.map((item) => (
						<li class="flex gap-3">
							<span class="mt-1.5 size-2 rounded-full bg-sky-600" />
							<span>{item}</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
