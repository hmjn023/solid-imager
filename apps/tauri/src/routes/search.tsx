import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import { Input } from "@solid-imager/ui/input";
import {
	Switch,
	SwitchControl,
	SwitchLabel,
	SwitchThumb,
} from "@solid-imager/ui/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@solid-imager/ui/tabs";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
	getMockMedia,
	type MockMediaStatus,
	mockMedia,
	mockSearchTags,
	mockSources,
} from "../mocks/demo-data";

type SearchCollection = "all" | "favorites" | "review";
type SearchSort = "recent" | "rating" | "title";

export const Route = createFileRoute("/search")({
	component: SearchRoute,
});

function SearchRoute() {
	const [collection, setCollection] = createSignal<SearchCollection>("all");
	const [query, setQuery] = createSignal("");
	const [selectedSourceId, setSelectedSourceId] = createSignal<string | null>(
		null,
	);
	const [selectedStatus, setSelectedStatus] =
		createSignal<MockMediaStatus | null>(null);
	const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
	const [favoritesOnly, setFavoritesOnly] = createSignal(false);
	const [sortBy, setSortBy] = createSignal<SearchSort>("recent");
	const [previewMediaId, setPreviewMediaId] = createSignal<string | null>(null);

	const filteredMedia = createMemo(() => {
		const loweredQuery = query().trim().toLowerCase();

		return mockMedia
			.filter((item) => {
				if (collection() === "favorites" && !item.favorite) {
					return false;
				}
				if (collection() === "review" && item.status !== "review") {
					return false;
				}
				if (selectedSourceId() && item.sourceId !== selectedSourceId()) {
					return false;
				}
				if (selectedStatus() && item.status !== selectedStatus()) {
					return false;
				}
				if (favoritesOnly() && !item.favorite) {
					return false;
				}
				if (
					selectedTags().length > 0 &&
					!selectedTags().every((tag) => item.tags.includes(tag))
				) {
					return false;
				}
				if (!loweredQuery) {
					return true;
				}
				return [item.title, item.summary, item.author, ...item.tags]
					.join(" ")
					.toLowerCase()
					.includes(loweredQuery);
			})
			.slice()
			.sort((left, right) => {
				switch (sortBy()) {
					case "rating":
						return right.rating - left.rating;
					case "title":
						return left.title.localeCompare(right.title);
					default:
						return right.updatedAt.localeCompare(left.updatedAt);
				}
			});
	});

	const previewMedia = createMemo(() =>
		previewMediaId() ? getMockMedia(previewMediaId() ?? "") : undefined,
	);

	const toggleTag = (tag: string) => {
		setSelectedTags((tags) =>
			tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag],
		);
	};

	const resetFilters = () => {
		setQuery("");
		setSelectedSourceId(null);
		setSelectedStatus(null);
		setSelectedTags([]);
		setFavoritesOnly(false);
		setSortBy("recent");
	};

	return (
		<section class="grid gap-6">
			<div class="grid gap-3">
				<h1 class="font-semibold text-4xl tracking-tight">Search</h1>
				<p class="max-w-3xl text-muted-foreground">
					Server 側の検索画面に近い操作面を、ローカル mock media
					で再現しています。 テキスト検索、source/status/tag 絞り込み、preview
					dialog、detail route 遷移を確認できます。
				</p>
			</div>

			<Tabs
				class="grid gap-4"
				onChange={(value) => setCollection(value as SearchCollection)}
				value={collection()}
			>
				<TabsList class="grid h-auto grid-cols-3 gap-2 p-1 md:w-fit">
					<TabsTrigger value="all">All Media</TabsTrigger>
					<TabsTrigger value="favorites">Favorites</TabsTrigger>
					<TabsTrigger value="review">Needs Review</TabsTrigger>
				</TabsList>

				<TabsContent value={collection()}>
					<div class="grid gap-6 lg:grid-cols-[320px_1fr]">
						<Card class="h-fit">
							<CardHeader>
								<CardTitle>Filters</CardTitle>
							</CardHeader>
							<CardContent class="grid gap-5">
								<Input
									onInput={(event) => setQuery(event.currentTarget.value)}
									placeholder="Search title, author, tag..."
									value={query()}
								/>

								<div class="grid gap-2">
									<span class="font-medium text-sm">Source</span>
									<div class="flex flex-wrap gap-2">
										<Button
											onClick={() => setSelectedSourceId(null)}
											size="sm"
											variant={
												selectedSourceId() === null ? "default" : "outline"
											}
										>
											All
										</Button>
										<For each={mockSources}>
											{(source) => (
												<Button
													onClick={() => setSelectedSourceId(source.id)}
													size="sm"
													variant={
														selectedSourceId() === source.id
															? "default"
															: "outline"
													}
												>
													{source.name}
												</Button>
											)}
										</For>
									</div>
								</div>

								<div class="grid gap-2">
									<span class="font-medium text-sm">Status</span>
									<div class="flex flex-wrap gap-2">
										<For each={["queued", "review", "tagged"] as const}>
											{(status) => (
												<Button
													onClick={() =>
														setSelectedStatus((current) =>
															current === status ? null : status,
														)
													}
													size="sm"
													variant={
														selectedStatus() === status ? "default" : "outline"
													}
												>
													{status}
												</Button>
											)}
										</For>
									</div>
								</div>

								<div class="grid gap-2">
									<span class="font-medium text-sm">Tags</span>
									<div class="flex flex-wrap gap-2">
										<For each={mockSearchTags}>
											{(tag) => (
												<Button
													onClick={() => toggleTag(tag)}
													size="sm"
													variant={
														selectedTags().includes(tag) ? "default" : "outline"
													}
												>
													{tag}
												</Button>
											)}
										</For>
									</div>
								</div>

								<Switch checked={favoritesOnly()} onChange={setFavoritesOnly}>
									<div class="flex items-center gap-3">
										<SwitchControl>
											<SwitchThumb />
										</SwitchControl>
										<SwitchLabel>Only favorites</SwitchLabel>
									</div>
								</Switch>

								<div class="grid gap-2">
									<span class="font-medium text-sm">Sort</span>
									<div class="flex flex-wrap gap-2">
										<For each={["recent", "rating", "title"] as const}>
											{(sort) => (
												<Button
													onClick={() => setSortBy(sort)}
													size="sm"
													variant={sortBy() === sort ? "default" : "outline"}
												>
													{sort}
												</Button>
											)}
										</For>
									</div>
								</div>

								<Button onClick={resetFilters} variant="outline">
									Reset Filters
								</Button>
							</CardContent>
						</Card>

						<div class="grid gap-4">
							<div class="flex items-center justify-between gap-4">
								<div class="flex items-center gap-2">
									<Badge variant="outline">
										{filteredMedia().length} results
									</Badge>
									<Show when={selectedTags().length > 0}>
										<Badge variant="secondary">
											{selectedTags().length} tags active
										</Badge>
									</Show>
								</div>
								<p class="text-muted-foreground text-sm">
									Collection: {collection()}
								</p>
							</div>

							<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
								<For each={filteredMedia()}>
									{(item) => (
										<Card class="overflow-hidden">
											<div
												class="h-36 w-full"
												style={{ background: item.accent }}
											/>
											<CardHeader class="gap-3">
												<div class="flex items-center justify-between gap-3">
													<CardTitle class="text-xl">{item.title}</CardTitle>
													<Badge
														variant={
															item.status === "review"
																? "destructive"
																: item.status === "tagged"
																	? "secondary"
																	: "outline"
														}
													>
														{item.status}
													</Badge>
												</div>
												<p class="text-muted-foreground text-sm">
													{item.summary}
												</p>
											</CardHeader>
											<CardContent class="grid gap-4">
												<div class="flex flex-wrap gap-2">
													<For each={item.tags}>
														{(tag) => <Badge variant="outline">{tag}</Badge>}
													</For>
												</div>
												<div class="text-muted-foreground text-sm">
													{item.sourceName} · {item.author} · rating{" "}
													{item.rating}/5
												</div>
												<div class="flex flex-wrap gap-2">
													<Button
														onClick={() => setPreviewMediaId(item.id)}
														variant="outline"
													>
														Preview
													</Button>
													<Link
														class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
														params={{
															mediaId: item.id,
															mediaSourceId: item.sourceId,
														}}
														to="/sources/$mediaSourceId/$mediaId"
													>
														Open Detail
													</Link>
												</div>
											</CardContent>
										</Card>
									)}
								</For>
							</div>

							<Show when={filteredMedia().length === 0}>
								<Card>
									<CardContent class="py-10 text-center text-muted-foreground">
										No media matched the current mock filters.
									</CardContent>
								</Card>
							</Show>
						</div>
					</div>
				</TabsContent>
			</Tabs>

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						setPreviewMediaId(null);
					}
				}}
				open={previewMediaId() !== null}
			>
				<DialogContent>
					<Show when={previewMedia()}>
						{(item) => (
							<>
								<DialogHeader>
									<DialogTitle>{item().title}</DialogTitle>
								</DialogHeader>
								<div
									class="h-48 rounded-xl"
									style={{ background: item().accent }}
								/>
								<div class="grid gap-3 text-sm">
									<p>{item().summary}</p>
									<p class="text-muted-foreground">
										{item().resolution} · {item().updatedAt}
									</p>
									<p class="rounded-xl border bg-muted/40 p-4 text-muted-foreground">
										{item().prompt}
									</p>
								</div>
							</>
						)}
					</Show>
				</DialogContent>
			</Dialog>
		</section>
	);
}
