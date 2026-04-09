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
import { createFileRoute } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { MediaGridItem } from "../components/media/media-grid-item";
import {
	SearchControlPanel,
	type TauriSearchMode,
	type TauriSortBy,
} from "../components/media/search-control-panel";
import type { TauriSearchFilterState } from "../components/media/search-filters";
import {
	mockCharacters,
	mockIps,
	mockMedia,
	mockProjects,
	mockSearchTags,
	mockSources,
} from "../mocks/demo-data";

export const Route = createFileRoute("/search")({
	component: SearchRoute,
});

function SearchRoute() {
	const [mode, setMode] = createSignal<TauriSearchMode>("simple");
	const [advancedQuery, setAdvancedQuery] = createSignal("");
	const [selectedSource, setSelectedSource] = createSignal("");
	const [state, setState] = createStore<TauriSearchFilterState>({
		searchQuery: "",
		selectedTags: [],
		excludeTags: [],
		selectedProjects: [],
		selectedIps: [],
		selectedCharacters: [],
		selectedAuthors: [],
		selectedStatus: null,
		favoritesOnly: false,
		sortBy: "date",
		sortOrder: "desc",
	});

	const advancedFilters = createMemo(() => {
		if (mode() !== "pro") {
			return {};
		}
		try {
			return JSON.parse(advancedQuery()) as {
				authorId?: string;
				status?: "queued" | "review" | "tagged";
				tag?: string;
				projectId?: string;
				favorite?: boolean;
			};
		} catch {
			return {};
		}
	});

	const filterData = createMemo(() => {
		const sourceId = selectedSource();
		const mediaList = sourceId
			? mockMedia.filter((media) => media.mediaSourceId === sourceId)
			: mockMedia;
		const authorMap = new Map();

		for (const media of mediaList) {
			for (const author of media.authors) {
				authorMap.set(author.id, author);
			}
		}

		return {
			authors: Array.from(authorMap.values()),
			characters: mockCharacters.map((item) => ({
				id: item.id,
				name: item.name,
			})),
			ips: mockIps.map((item) => ({ id: item.id, name: item.name })),
			projects: mockProjects.map((item) => ({ id: item.id, name: item.name })),
			tags: mockSearchTags,
		};
	});

	const searchResults = createMemo(() => {
		const loweredQuery = state.searchQuery.trim().toLowerCase();
		const filters = advancedFilters();

		return mockMedia
			.filter((media) => {
				if (selectedSource() && media.mediaSourceId !== selectedSource()) {
					return false;
				}
				if (state.selectedStatus && media.status !== state.selectedStatus) {
					return false;
				}
				if (state.favoritesOnly && !media.favorite) {
					return false;
				}
				if (
					state.selectedTags.length > 0 &&
					!state.selectedTags.every((tag) => media.tags.includes(tag))
				) {
					return false;
				}
				if (state.excludeTags.some((tag) => media.tags.includes(tag))) {
					return false;
				}
				if (
					state.selectedProjects.length > 0 &&
					!state.selectedProjects.every((projectId) =>
						media.projects.some((project) => project.id === projectId),
					)
				) {
					return false;
				}
				if (
					state.selectedIps.length > 0 &&
					!state.selectedIps.every((ipId) =>
						media.ips.some((ip) => ip.id === ipId),
					)
				) {
					return false;
				}
				if (
					state.selectedCharacters.length > 0 &&
					!state.selectedCharacters.every((characterId) =>
						media.characters.some((character) => character.id === characterId),
					)
				) {
					return false;
				}
				if (
					state.selectedAuthors.length > 0 &&
					!state.selectedAuthors.every((authorId) =>
						media.authors.some((author) => author.id === authorId),
					)
				) {
					return false;
				}
				if (
					filters.authorId &&
					!media.authors.some((author) => author.id === filters.authorId)
				) {
					return false;
				}
				if (filters.status && media.status !== filters.status) {
					return false;
				}
				if (filters.tag && !media.tags.includes(filters.tag)) {
					return false;
				}
				if (
					filters.projectId &&
					!media.projects.some((project) => project.id === filters.projectId)
				) {
					return false;
				}
				if (
					filters.favorite !== undefined &&
					media.favorite !== filters.favorite
				) {
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
					...media.projects.map((project) => project.name),
					...media.ips.map((ip) => ip.name),
					...media.characters.map((character) => character.name),
				]
					.join(" ")
					.toLowerCase()
					.includes(loweredQuery);
			})
			.slice()
			.sort((left, right) => {
				const direction = state.sortOrder === "asc" ? 1 : -1;
				switch (state.sortBy as TauriSortBy) {
					case "date":
						return left.modifiedAt.localeCompare(right.modifiedAt) * direction;
					case "name":
						return left.fileName.localeCompare(right.fileName) * direction;
					case "size":
						return (left.fileSize - right.fileSize) * direction;
					case "rating":
						return (left.rating - right.rating) * direction;
					case "viewCount":
						return (left.viewCount - right.viewCount) * direction;
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
			setAdvancedQuery('{ "author": "nova", "status": "review" }');
		}
	};

	const panel = (
		<SearchControlPanel
			advancedQuery={advancedQuery()}
			context="global"
			filterData={filterData()}
			mode={mode()}
			onAdvancedQueryChange={setAdvancedQuery}
			onModeChange={handleModeChange}
			onSearch={handleSearch}
			onSelectSource={setSelectedSource}
			selectedSource={selectedSource()}
			setState={setState}
			state={state}
			sources={mockSources}
		/>
	);

	return (
		<main class="container mx-auto p-4">
			<div class="mb-8 flex items-center justify-between">
				<div>
					<h1 class="mb-2 font-bold text-3xl">メディア検索</h1>
					<p class="text-gray-600">タグやファイル名でメディアを検索できます</p>
				</div>
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
							{searchResults().length} 件の結果
						</p>
					</div>

					<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
						<For each={searchResults()}>
							{(media) => <MediaGridItem media={media} />}
						</For>
					</div>

					<Show when={searchResults().length === 0}>
						<div class="py-12 text-center text-gray-500">
							検索結果が見つかりませんでした
						</div>
					</Show>
				</div>
			</div>
		</main>
	);
}
