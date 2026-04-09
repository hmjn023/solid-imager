import { Badge } from "@solid-imager/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { For } from "solid-js";

const migrationChecks = [
	"Navigation matches the standalone route tree.",
	"Dialogs and tab state work without SSR assumptions.",
	"Search and source detail pages can be traversed end-to-end.",
	"Manager and config pages expose the intended interaction surfaces.",
];

export const Route = createFileRoute("/about")({
	component: AboutRoute,
});

function AboutRoute() {
	return (
		<section class="grid gap-6">
			<div class="grid gap-3">
				<Badge variant="outline">Migration Notes</Badge>
				<h1 class="font-semibold text-4xl tracking-tight">
					About This SPA Port
				</h1>
				<p class="max-w-3xl text-lg text-muted-foreground">
					The Tauri app now owns its own route tree and mock interaction
					surfaces. This page documents what is intentionally verified before
					the real API client replaces the local demo state.
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Current Verification Focus</CardTitle>
				</CardHeader>
				<CardContent class="grid gap-3">
					<For each={migrationChecks}>
						{(item) => (
							<div class="flex items-center gap-3 rounded-lg border px-4 py-3">
								<span class="size-2 rounded-full bg-sky-600" />
								<span>{item}</span>
							</div>
						)}
					</For>
				</CardContent>
			</Card>
			<p class="text-sm text-muted-foreground">
				<Link class="text-sky-700 hover:underline" to="/">
					Back to dashboard
				</Link>
			</p>
		</section>
	);
}
