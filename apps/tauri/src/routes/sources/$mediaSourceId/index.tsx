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
	DialogTrigger,
} from "@solid-imager/ui/dialog";
import { toast } from "@solid-imager/ui/toast";
import { createFileRoute, useParams } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Show } from "solid-js";
import { MediaGridItem } from "../../../components/media/media-grid-item";
import {
	SearchControlPanel,
	type TauriSearchMode,
	type TauriSortBy,
	type TauriSortOrder,
} from "../../../components/media/search-control-panel";
import {
	getMockMediaBySource,
	getMockSource,
	type MockMediaStatus,
	mockSearchTags,
} from "../../../mocks/demo-data";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	component: SourceMediaRoute,
});

function SourceMediaRoute() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const [mode, setMode] = createSignal<TauriSearchMode>("simple");
	const [searchQuery, setSearchQuery] = createSignal("");
	const [advancedQuery, setAdvancedQuery] = createSignal("");
	const [selectedStatus, setSelectedStatus] =
		createSignal<MockMediaStatus | null>(null);
	const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
	const [favoritesOnly, setFavoritesOnly] = createSignal(false);
	const [sortBy, setSortBy] = createSignal<TauriSortBy>("updatedAt");
	const [sortOrder, setSortOrder] = createSignal<TauriSortOrder>("desc");

	const source = createMemo(() => getMockSource(params().mediaSourceId));
	const advancedFilters = createMemo(() => {
		if (mode() !== "pro") {
			return {};
		}
		try {
			return JSON.parse(advancedQuery()) as {
				author?: string;
				status?: MockMediaStatus;
				tag?: string;
			};
		} catch {
			return {};
		}
	});

	const mediaResults = createMemo(() => {
		const loweredQuery = searchQuery().trim().toLowerCase();
		const filters = advancedFilters();

		return getMockMediaBySource(params().mediaSourceId)
			.filter((media) => {
				if (selectedStatus() && media.status !== selectedStatus()) {
					return false;
				}
				if (favoritesOnly() && !media.favorite) {
					return false;
				}
				if (
					selectedTags().length > 0 &&
					!selectedTags().every((tag) => media.tags.includes(tag))
				) {
					return false;
				}
				if (
					filters.author &&
					!media.authors.some((author) =>
						author.name
							.toLowerCase()
							.includes(filters.author?.toLowerCase() ?? ""),
					)
				) {
					return false;
				}
				if (filters.status && media.status !== filters.status) {
					return false;
				}
				if (filters.tag && !media.tags.includes(filters.tag)) {
					return false;
				}
				if (!loweredQuery) {
					return true;
				}
				return [
					media.fileName,
					media.title,
					media.summary,
					...media.tags,
					...media.authors.map((author) => author.name),
				]
					.join(" ")
					.toLowerCase()
					.includes(loweredQuery);
			})
			.slice()
			.sort((left, right) => {
				const direction = sortOrder() === "asc" ? 1 : -1;
				switch (sortBy()) {
					case "createdAt":
					case "updatedAt":
						return left.updatedAt.localeCompare(right.updatedAt) * direction;
					case "fileName":
						return left.fileName.localeCompare(right.fileName) * direction;
					case "rating":
						return (left.rating - right.rating) * direction;
					default:
						return 0;
				}
			});
	});

	const handleSearch = () => {
		window.scrollTo({ top: 0 });
	};

	const handleModeChange = (nextMode: TauriSearchMode) => {
		setMode(nextMode);
		if (nextMode === "simple") {
			setAdvancedQuery("");
		} else if (!advancedQuery()) {
			setAdvancedQuery('{ "status": "review", "tag": "reference" }');
		}
	};

	const toggleTag = (tag: string) => {
		setSelectedTags((tags) =>
			tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag],
		);
	};

	const panel = (
		<SearchControlPanel
			advancedQuery={advancedQuery()}
			context="source"
			favoritesOnly={favoritesOnly()}
			mode={mode()}
			onAdvancedQueryChange={setAdvancedQuery}
			onFavoritesOnlyChange={setFavoritesOnly}
			onModeChange={handleModeChange}
			onSearch={handleSearch}
			onSortByChange={setSortBy}
			onSortOrderChange={setSortOrder}
			onStatusChange={setSelectedStatus}
			onTagToggle={toggleTag}
			onTextQueryChange={setSearchQuery}
			searchQuery={searchQuery()}
			selectedStatus={selectedStatus()}
			selectedTags={selectedTags()}
			sortBy={sortBy()}
			sortOrder={sortOrder()}
			tags={mockSearchTags}
		/>
	);

	return (
		<main class="container mx-auto p-4">
			<div class="mb-8 flex items-center justify-between">
				<div>
					<h1 class="mb-2 font-bold text-3xl">
						{source()?.name ?? "Media Source"}
					</h1>
					<p class="text-gray-600">{source()?.description}</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button onClick={() => toast.success("Mock upload flow opened")}>
						Add Media
					</Button>
					<Button
						onClick={() => toast.success("Mock JSON dump download started")}
						variant="outline"
					>
						Dump JSON
					</Button>
					<Button
						onClick={() => toast.success("Mock ZIP dump download started")}
						variant="outline"
					>
						Dump ZIP
					</Button>
					<Button
						onClick={() => toast.success("Mock restore flow opened")}
						variant="outline"
					>
						Restore
					</Button>
					<div class="md:hidden">
						<Dialog>
							<DialogTrigger as={Button} variant="outline">
								Filters
							</DialogTrigger>
							<DialogContent class="max-h-[80vh] overflow-y-auto">
								<DialogHeader>
									<DialogTitle>検索フィルター</DialogTitle>
								</DialogHeader>
								<div class="space-y-4">{panel}</div>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			</div>

			<div class="grid gap-6 md:grid-cols-[300px_1fr]">
				<Card class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
					<CardHeader>
						<CardTitle>検索フィルター</CardTitle>
					</CardHeader>
					<CardContent class="space-y-4">{panel}</CardContent>
				</Card>

				<div class="space-y-4">
					<div class="mb-4 flex items-center justify-between">
						<p class="text-gray-600 text-sm">
							{mediaResults().length} 件の結果
						</p>
					</div>

					<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
						<For each={mediaResults()}>
							{(media) => <MediaGridItem media={media} />}
						</For>
					</div>

					<Show when={mediaResults().length === 0}>
						<div class="py-12 text-center text-gray-500">
							検索結果が見つかりませんでした
						</div>
					</Show>
				</div>
			</div>
		</main>
	);
}
