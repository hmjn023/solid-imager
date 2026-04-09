import { Badge } from "@solid-imager/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import { Input } from "@solid-imager/ui/input";
import { PaginationControls } from "@solid-imager/ui/pagination-controls";
import {
	Switch,
	SwitchControl,
	SwitchLabel,
	SwitchThumb,
} from "@solid-imager/ui/switch";
import { createFileRoute, Link, useParams } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
	getMockMediaBySource,
	getMockSource,
	type MockMedia,
} from "../../../mocks/demo-data";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	component: SourceDetailRoute,
});

function SourceDetailRoute() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const [query, setQuery] = createSignal("");
	const [onlyTagged, setOnlyTagged] = createSignal(false);
	const [currentPage, setCurrentPage] = createSignal(1);
	const pageSize = 4;

	const source = createMemo(() => getMockSource(params().mediaSourceId));
	const filteredMedia = createMemo(() => {
		const loweredQuery = query().trim().toLowerCase();
		return getMockMediaBySource(params().mediaSourceId).filter((item) => {
			if (onlyTagged() && item.status !== "tagged") {
				return false;
			}
			if (!loweredQuery) {
				return true;
			}
			return [item.title, item.summary, ...item.tags]
				.join(" ")
				.toLowerCase()
				.includes(loweredQuery);
		});
	});

	const totalPages = createMemo(() =>
		Math.max(1, Math.ceil(filteredMedia().length / pageSize)),
	);
	const pagedMedia = createMemo(() => {
		const start = (currentPage() - 1) * pageSize;
		return filteredMedia().slice(start, start + pageSize);
	});

	return (
		<section class="grid gap-6">
			<div class="flex items-start justify-between gap-4">
				<div class="grid gap-3">
					<Link class="text-sky-700 text-sm hover:underline" to="/sources">
						Back to sources
					</Link>
					<h1 class="font-semibold text-4xl tracking-tight">
						{source()?.name ?? "Unknown Source"}
					</h1>
					<p class="max-w-3xl text-muted-foreground">
						{source()?.description ??
							"This source was not found in the mock dataset."}
					</p>
				</div>
				<Show when={source()}>
					{(item) => <Badge variant="outline">{item().mediaCount} items</Badge>}
				</Show>
			</div>

			<div class="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-[1fr_auto] md:items-end">
				<div class="grid gap-2">
					<label class="font-medium text-sm" for="source-search">
						Filter media
					</label>
					<Input
						id="source-search"
						onInput={(event) => {
							setQuery(event.currentTarget.value);
							setCurrentPage(1);
						}}
						placeholder="Search within this source"
						value={query()}
					/>
				</div>
				<Switch checked={onlyTagged()} onChange={setOnlyTagged}>
					<div class="flex items-center gap-3">
						<SwitchControl>
							<SwitchThumb />
						</SwitchControl>
						<SwitchLabel>Only tagged</SwitchLabel>
					</div>
				</Switch>
			</div>

			<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<For each={pagedMedia()}>
					{(item) => <SourceMediaCard item={item} />}
				</For>
			</div>

			<Show when={pagedMedia().length === 0}>
				<Card>
					<CardContent class="py-10 text-center text-muted-foreground">
						No media matched this source filter.
					</CardContent>
				</Card>
			</Show>

			<PaginationControls
				class="justify-end"
				currentPage={currentPage()}
				onPageChange={setCurrentPage}
				totalPages={totalPages()}
			/>
		</section>
	);
}

function SourceMediaCard(props: { item: MockMedia }) {
	return (
		<Card class="overflow-hidden">
			<div class="h-28 w-full" style={{ background: props.item.accent }} />
			<CardHeader class="gap-3">
				<div class="flex items-center justify-between gap-3">
					<CardTitle class="text-xl">{props.item.title}</CardTitle>
					<Badge variant="outline">{props.item.status}</Badge>
				</div>
				<p class="text-muted-foreground text-sm">{props.item.summary}</p>
			</CardHeader>
			<CardContent class="grid gap-3">
				<div class="flex flex-wrap gap-2">
					<For each={props.item.tags}>
						{(tag) => <Badge variant="secondary">{tag}</Badge>}
					</For>
				</div>
				<Link
					class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
					params={{
						mediaId: props.item.id,
						mediaSourceId: props.item.sourceId,
					}}
					to="/sources/$mediaSourceId/$mediaId"
				>
					Open Detail
				</Link>
			</CardContent>
		</Card>
	);
}
