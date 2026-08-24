import { persistSearchScrollPosition } from "@solid-imager/ui/hooks/use-current-search-persistence";
import {
	type MediaCollectionSelectionMode,
	useMediaCollectionSelection,
} from "@solid-imager/ui/hooks/use-media-collection-selection";
import { useSearchHistoryPersistence } from "@solid-imager/ui/hooks/use-search-history-persistence";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { V2SearchScreen } from "@solid-imager/ui/screens/v2-search-screen";
import { createSearchHistoryClient } from "@solid-imager/ui/search-history-client";
import { useLocation, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import { ThumbnailImage } from "~/components/media/thumbnail-image";
import { V2MediaGridItem } from "~/components/media/v2-media-grid-item";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";
import { SearchHistoryClient as rawSearchHistoryClient } from "~/infrastructure/api/clients/search-history-client";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
	tagsQueryOptions,
} from "~/infrastructure/api-clients/queries";
import {
	searchMedia,
	searchSimilar,
} from "~/infrastructure/api-clients/search-api";
import {
	getSearchCondition,
	searchState,
	setSearchState,
} from "~/presentation/store/search-store";
import { saveV2MediaContext } from "../media-context";

const SEARCH_RESULTS_REFRESH_DEBOUNCE_MS = 300;
const V2_SEARCH_RESULTS_PER_PAGE = 200;
const PresetClient = createPresetClient(rawPresetClient);
const SearchHistoryClient = createSearchHistoryClient(rawSearchHistoryClient);

function rememberReturnPath(href: string): void {
	try {
		sessionStorage.setItem("v2:media-return", href);
	} catch {
		// Session storage is optional; media detail navigation must continue.
	}
}

export default function V2SearchContent() {
	const location = useLocation();
	const navigate = useNavigate();
	const [visibleMediaIds, setVisibleMediaIds] = createSignal<readonly string[]>(
		[],
	);
	const selection = useMediaCollectionSelection(visibleMediaIds);
	const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
	const handleSelection = (
		mediaId: string,
		mode: MediaCollectionSelectionMode,
	) => {
		setIsBulkSelectMode(true);
		selection.select(mediaId, mode);
	};
	const clearSelection = () => {
		setIsBulkSelectMode(false);
		selection.clear();
	};
	const searchHistory = useSearchHistoryPersistence("all", {
		client: SearchHistoryClient,
		surface: "v2",
	});
	const page = useSearchPage({
		searchMedia,
		searchSimilar,
		queries: {
			tags: tagsQueryOptions,
			sources: mediaSourcesQueryOptions,
			projects: allProjectsQueryOptions,
			ips: allIpsQueryOptions,
			characters: allCharactersQueryOptions,
			authors: allAuthorsQueryOptions,
		},
		selectedSource: () => searchState.selectedSource,
		getSearchCondition,
		sortBy: () => searchState.sortBy,
		sortOrder: () => searchState.sortOrder,
		// V2 can display up to eight columns. Fetch enough complete rows per page
		// so scrolling does not stop for another request every two or three rows.
		limit: () => Math.max(searchState.limit, V2_SEARCH_RESULTS_PER_PAGE),
		scrollY: () => searchState.scrollY,
		setScrollY: (value) => {
			setSearchState("scrollY", value);
			persistSearchScrollPosition("all", value, {
				surface: "v2",
				historyEntryKey: searchHistory.historyEntryKey,
			});
		},
		setOffset: (value) => setSearchState("offset", value),
		mode: () => searchState.mode,
		similarityAnchorMediaId: () => searchState.similarityAnchorMediaId,
		similarityTopK: () => searchState.similarityTopK,
		refreshDebounceMs: SEARCH_RESULTS_REFRESH_DEBOUNCE_MS,
		isSearchStateRestored: searchHistory.isRestored,
		commitSearchHistory: searchHistory.commitNow,
		historyEntryKey: searchHistory.historyEntryKey,
		enableVirtualization: true,
		scrollContainerSelector: '[data-media-scroll="v2-search"]',
	});

	useMediaSourceEvents(() => searchState.selectedSource || "*", {
		onMediaAdded: page.refreshSearchResults,
		onMediaDeleted: page.refreshSearchResults,
		onMediaChanged: page.refreshSearchResults,
		onMediaCopied: page.refreshSearchResults,
		onMediaMoved: page.refreshSearchResults,
		onAllJobsCompleted: page.refreshSearchResults,
	});

	return (
		<V2SearchScreen
			enableVirtualization
			filterData={page.filterData}
			isBulkSelectMode={isBulkSelectMode}
			isSelected={selection.isSelected}
			onClearSelection={clearSelection}
			onSelectAll={() => {
				setIsBulkSelectMode(true);
				selection.selectAll();
			}}
			onSelectMedia={handleSelection}
			onSelectSource={(id) => setSearchState("selectedSource", id)}
			onToggleSelect={(mediaId) => handleSelection(mediaId, "toggle")}
			onVisibleMediaIdsChange={setVisibleMediaIds}
			page={page}
			presetClient={PresetClient}
			renderMediaItem={(media, options) => (
				<V2MediaGridItem
					imageLoadPolicy={options?.imageLoadPolicy}
					isBulkSelectMode={options?.isBulkSelectMode}
					isSelected={options?.isSelected}
					isPreviewSelected={options?.isPreviewSelected}
					media={media}
					onOpenMediaDetail={options?.onOpenMediaDetail}
					onPreviewSelect={options?.onPreviewSelect}
						onSelectGesture={options?.onSelectGesture}
						onToggleSelect={options?.onToggleSelect}
						priority={options?.priority}
					onPrepareMediaDetail={options?.onPrepareMediaDetail}
				/>
			)}
			onPrepareMediaDetail={(media, context) => {
				rememberReturnPath(location().href);
				saveV2MediaContext(location().href, context ?? [media]);
			}}
			onOpenMediaDetail={(media, context) => {
				rememberReturnPath(location().href);
				saveV2MediaContext(location().href, context ?? [media]);
				void navigate({
					params: {
						mediaId: media.id,
						mediaSourceId: media.mediaSourceId,
					},
					to: "/v2/sources/$mediaSourceId/$mediaId",
				});
			}}
			renderMediaPreview={(media) => (
				<ThumbnailImage
					alt={media.fileName}
					class="h-full w-full object-contain"
					height={media.height}
					loading="eager"
					media={media}
					requestedSize={512}
					width={media.width}
				/>
			)}
			selectedSource={searchState.selectedSource}
			selectedCount={() => selection.selectedIds().size}
			ssrGuard
			sources={page.sources()}
		/>
	);
}
