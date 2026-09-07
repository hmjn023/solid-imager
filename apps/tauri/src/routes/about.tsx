import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/about")({
	component: AboutRoute,
});

function AboutRoute() {
	return (
		<section class="h-full min-h-0 overflow-y-auto bg-[var(--app-canvas)] p-4 text-[var(--app-text)] sm:p-6">
			<header class="mb-4 flex flex-wrap items-start justify-between gap-3 border-[var(--app-border)] border-b pb-4">
				<div>
					<h1 class="font-semibold text-xl">About Solid Imager</h1>
					<p class="mt-1 text-sm text-[var(--app-text-secondary)]">
						メディアを整理・検索し、関連情報とバックグラウンド処理を管理します。
					</p>
				</div>
				<Badge
					class="border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] text-[var(--app-text-secondary)]"
					variant="outline"
				>
					Current UI
				</Badge>
			</header>
			<div class="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
				<Card class="border-[var(--app-border)] bg-[var(--app-surface)] shadow-none">
					<CardHeader class="p-5 pb-3">
						<CardTitle class="text-base">Media-first workspace</CardTitle>
					</CardHeader>
					<CardContent class="px-5 pb-5 text-sm leading-6 text-[var(--app-text-secondary)]">
						<p>
							複数のメディアソース、検索条件、タグ・作品・キャラクターなどの関連情報を一か所で扱います。
						</p>
					</CardContent>
				</Card>
				<Card class="border-[var(--app-border)] bg-[var(--app-surface)] shadow-none">
					<CardHeader class="p-5 pb-3">
						<CardTitle class="text-base">Documentation</CardTitle>
					</CardHeader>
					<CardContent class="space-y-2 px-5 pb-5">
						<Button as={Link} class="w-full" to="/search" variant="outline">
							Open Library
						</Button>
						<Button
							as="a"
							class="w-full"
							href="/docs/swagger"
							rel="noopener noreferrer"
							target="_blank"
							variant="outline"
						>
							API documentation
						</Button>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
