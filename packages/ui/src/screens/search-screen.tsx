import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { JSX } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../dialog";
import type {
	SearchPageFilterData,
	UseSearchPageResult,
} from "../hooks/use-search-page";
import type { SourceMediaPagePresetClient } from "../hooks/use-source-media-page";
import { SearchControlPanel } from "../search-control-panel";
import { SourceMediaGrid } from "../source-media-grid";

export type SearchScreenNavActions = {
	openMobileFilters: () => void;
};

export type SearchScreenProps = {
	page: UseSearchPageResult;
	filterData: SearchPageFilterData;
	sources: SafeMediaSource[] | undefined;
	selectedSource: string | null;
	onSelectSource: (id: string) => void;
	presetClient: SourceMediaPagePresetClient;
	renderNavActions?: (actions: SearchScreenNavActions) => JSX.Element;
	renderMediaItem: (media: Media) => JSX.Element;
	ssrGuard?: boolean;
	enableVirtualization?: boolean;
};

export function SearchScreen(props: SearchScreenProps) {
	const [isMounted, setIsMounted] = createSignal(false);
	const [isMobileFilterOpen, setIsMobileFilterOpen] = createSignal(false);

	onMount(() => {
		if (!isServer) {
			setIsMounted(true);
		}
	});

	const page = () => props.page;
	const openMobileFilters = () => setIsMobileFilterOpen(true);

	const panel = (
		<SearchControlPanel
			context="global"
			filterData={props.filterData}
			onSearch={page().handleSearch}
			onSelectSource={props.onSelectSource}
			presetClient={props.presetClient}
			selectedSource={props.selectedSource ?? undefined}
			sources={props.sources}
			usePopover={false}
		/>
	);

	const showResults = () => {
		if (props.ssrGuard) {
			return !page().searchResultQuery.isLoading && isMounted();
		}
		return !page().searchResultQuery.isLoading;
	};

	return (
		<main class="container mx-auto p-4">
			{props.renderNavActions?.({ openMobileFilters })}
			<Show when={!isServer}>
				<Dialog
					open={isMobileFilterOpen()}
					onOpenChange={setIsMobileFilterOpen}
				>
					<DialogContent class="max-h-[80vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>検索フィルター</DialogTitle>
						</DialogHeader>
						<div class="space-y-4">{panel}</div>
					</DialogContent>
				</Dialog>
			</Show>

			<div class="mb-8 flex items-center justify-between">
				<div>
					<h1 class="mb-2 font-bold text-3xl">メディア検索</h1>
					<p class="text-gray-600">タグやファイル名でメディアを検索できます</p>
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
					<Show
						fallback={<div class="py-8 text-center">読み込み中...</div>}
						when={showResults()}
					>
						<SourceMediaGrid
							disableContextMenu
							enableVirtualization={props.enableVirtualization}
							isError={page().searchResultQuery.isError}
							isFetchingNextPage={page().searchResultQuery.isFetchingNextPage}
							isPending={page().searchResultQuery.isLoading}
							mediaResults={page().searchResults}
							mediaSourceId={() => undefined}
							queryError={page().searchResultQuery.error instanceof Error ? page().searchResultQuery.error : null}
							renderItem={(media, _options) => props.renderMediaItem(media)}
							setLoadMoreRef={page().setLoadMoreRef}
							showEmptyState
							showResultCount
							totalCount={page().searchResultQuery.data?.pages[0]?.total}
						/>
					</Show>
				</div>
			</div>
		</main>
	);
}
