import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { JSX } from "solid-js";
import { createSignal, For, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { Card, CardContent, CardHeader, CardTitle } from "../card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../dialog";
import type { SearchPageFilterData, UseSearchPageResult } from "../hooks/use-search-page";
import type { SourceMediaPagePresetClient } from "../hooks/use-source-media-page";
import { SearchControlPanel } from "../search-control-panel";

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
				<Dialog open={isMobileFilterOpen()} onOpenChange={setIsMobileFilterOpen}>
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
					<Show fallback={<div class="py-8 text-center">読み込み中...</div>} when={showResults()}>
						<Show
							fallback={<div class="py-12 text-center text-gray-500" />}
							when={page().searchResultQuery.data}
						>
							<div class="mb-4 flex items-center justify-between">
								<p class="text-gray-600 text-sm">
									{page().searchResultQuery.data?.pages[0]?.total || 0} 件の結果
								</p>
							</div>

							<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
								<For each={page().searchResults()}>{(media) => props.renderMediaItem(media)}</For>
							</div>

							<div class="h-10 w-full" ref={page().setLoadMoreRef}>
								<Show when={page().searchResultQuery.isFetchingNextPage}>
									<div class="py-4 text-center text-gray-500">読み込み中...</div>
								</Show>
							</div>

							<Show when={(page().searchResultQuery.data?.pages[0]?.total || 0) === 0}>
								<div class="py-12 text-center text-gray-500">検索結果が見つかりませんでした</div>
							</Show>
						</Show>
					</Show>
				</div>
			</div>
		</main>
	);
}
