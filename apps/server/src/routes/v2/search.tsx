import { useCurrentSearchPersistence } from "@solid-imager/ui/hooks/use-current-search-persistence";
import { useSearchPage } from "@solid-imager/ui/hooks/use-search-page";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SearchScreen } from "@solid-imager/ui/screens/search-screen";
import {
	createFileRoute,
	useLocation,
	useNavigate,
} from "@tanstack/solid-router";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { ThumbnailImage } from "~/components/media/thumbnail-image";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";
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

const SEARCH_RESULTS_REFRESH_DEBOUNCE_MS = 300;
const PresetClient = createPresetClient(rawPresetClient);

export const Route = createFileRoute("/v2/search")({
	component: V2SearchRoute,
});

function V2SearchRoute() {
	const location = useLocation();
	const navigate = useNavigate();
	const isSearchStateRestored = useCurrentSearchPersistence("all");
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
		limit: () => searchState.limit,
		scrollY: () => searchState.scrollY,
		setScrollY: (value) => setSearchState("scrollY", value),
		setOffset: (value) => setSearchState("offset", value),
		mode: () => searchState.mode,
		similarityAnchorMediaId: () => searchState.similarityAnchorMediaId,
		similarityTopK: () => searchState.similarityTopK,
		refreshDebounceMs: SEARCH_RESULTS_REFRESH_DEBOUNCE_MS,
		isSearchStateRestored,
		scrollContainerSelector: "[data-media-scroll]",
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
		<SearchScreen
			enableVirtualization
			filterData={page.filterData}
			onSelectSource={(id) => setSearchState("selectedSource", id)}
			page={page}
			presetClient={PresetClient}
			renderMediaItem={(media, options) => (
				<MediaGridItem
					isSelected={options?.isPreviewSelected}
					media={media}
					onPreviewSelect={options?.onPreviewSelect}
					routeVersion="v2"
				/>
			)}
			onOpenMediaDetail={(media) => {
				sessionStorage.setItem("v2:media-return", location().href);
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
					width={media.width}
				/>
			)}
			selectedSource={searchState.selectedSource}
			sources={page.sources()}
			variant="v2"
		/>
	);
}
