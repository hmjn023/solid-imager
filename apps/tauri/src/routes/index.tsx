import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { For } from "solid-js";
import {
	mockCharacters,
	mockMedia,
	mockProjects,
	mockSources,
} from "~/mocks/demo-data";

const dashboardLinks = [
	{
		title: "Search",
		description: "Filter media, open previews, and jump into detail pages.",
		to: "/search",
		count: `${mockMedia.length} items`,
	},
	{
		title: "Sources",
		description:
			"Browse source cards, open dialogs, and verify route transitions.",
		to: "/sources",
		count: `${mockSources.length} sources`,
	},
	{
		title: "Manager",
		description:
			"Switch tabs, edit entities, and simulate batch tagging progress.",
		to: "/manager",
		count: `${mockProjects.length + mockCharacters.length} entities`,
	},
	{
		title: "Settings",
		description:
			"Edit configuration tabs and save changes through the local backend.",
		to: "/config",
		count: "5 sections",
	},
] as const;

export const Route = createFileRoute("/")({
	component: HomeRoute,
});

function HomeRoute() {
	return (
		<section class="grid gap-8">
			<div class="grid gap-4 md:grid-cols-[1.8fr_1fr]">
				<div class="grid gap-4 rounded-3xl border border-border bg-card p-8 shadow-sm">
					<div class="flex items-center gap-3">
						<Badge variant="outline">Tauri SPA</Badge>
						<Badge variant="secondary">Issue 219</Badge>
					</div>
					<div class="grid gap-3">
						<h1 class="max-w-3xl font-semibold text-4xl tracking-tight">
							Standalone routes are now interactive enough for navigation
							checks.
						</h1>
						<p class="max-w-2xl text-lg text-muted-foreground">
							This dashboard mirrors the major `apps/server` pages inside the
							Tauri route tree. Use it to verify page transitions, dialogs,
							filters, and core local workflows while server parity is being
							closed.
						</p>
					</div>
					<div class="flex flex-wrap gap-3">
						<Button as={Link} to="/search">
							Open Search Sandbox
						</Button>
						<Button as={Link} to="/sources" variant="outline">
							Browse Sources
						</Button>
					</div>
				</div>
				<Card>
					<CardHeader>
						<CardTitle>Current Local State</CardTitle>
					</CardHeader>
					<CardContent class="grid gap-4 text-sm">
						<div class="flex items-center justify-between rounded-lg border px-4 py-3">
							<span class="text-muted-foreground">Media</span>
							<span class="font-semibold">{mockMedia.length}</span>
						</div>
						<div class="flex items-center justify-between rounded-lg border px-4 py-3">
							<span class="text-muted-foreground">Sources</span>
							<span class="font-semibold">{mockSources.length}</span>
						</div>
						<div class="flex items-center justify-between rounded-lg border px-4 py-3">
							<span class="text-muted-foreground">Projects</span>
							<span class="font-semibold">{mockProjects.length}</span>
						</div>
					</CardContent>
				</Card>
			</div>
			<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<For each={dashboardLinks}>
					{(item) => (
						<Card class="transition-colors hover:border-sky-400">
							<CardHeader class="gap-3">
								<div class="flex items-center justify-between">
									<CardTitle>{item.title}</CardTitle>
									<Badge variant="outline">{item.count}</Badge>
								</div>
								<p class="text-muted-foreground text-sm">{item.description}</p>
							</CardHeader>
							<CardContent>
								<Link
									class="inline-flex items-center font-medium text-sky-700 text-sm hover:underline"
									to={item.to}
								>
									Open route
								</Link>
							</CardContent>
						</Card>
					)}
				</For>
			</div>
		</section>
	);
}
