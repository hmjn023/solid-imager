import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type {
	Author,
	Media,
	MediaSearchRequest,
} from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import {
	type Accessor,
	type Component,
	createEffect,
	type JSX,
} from "solid-js";
import { isServer } from "solid-js/web";
import type { SearchPersistenceSurface } from "./hooks/use-current-search-persistence";
import type { MediaCollectionSelectionMode } from "./hooks/use-media-collection-selection";
import type { MediaSourceEventTransport } from "./hooks/use-media-source-events";
import { useSearchHistoryPersistence } from "./hooks/use-search-history-persistence";
import {
	type SourceMediaPageActions,
	type SourceMediaPagePresetClient,
	useSourceMediaPage,
} from "./hooks/use-source-media-page";
import { MediaListActions } from "./media-list-actions";
import { toQueryUiState } from "./query-state";
import type { SourceMediaScreenProps } from "./screens/source-media-screen.types";
import type { SearchHistoryClient } from "./search-history-client";

// biome-ignore lint/suspicious/noExplicitAny: oRPC query option factories do not satisfy Solid Query's overloaded public type
type QueryOptionFactory<_TData> = () => any;

function clientOnlyQueryOptions<TData>(factory: QueryOptionFactory<TData>) {
	return () => ({
		...factory(),
		enabled: !isServer,
	});
}

export type SourceMediaPageProps = {
	mediaSourceId: Accessor<string>;
	mediaSourceName?: Accessor<string | undefined>;
	transport: MediaSourceEventTransport;
	presetClient: SourceMediaPagePresetClient;
	actions: SourceMediaPageActions;
	getSearchCondition: () => MediaSearchRequest["condition"];
	sortBy: () => MediaSearchRequest["sort"];
	sortOrder: () => "asc" | "desc";
	onThumbnailReady?: (mediaId: string) => void;
	tagsQueryOptions: QueryOptionFactory<TagResponse[]>;
	projectsQueryOptions: QueryOptionFactory<Project[]>;
	ipsQueryOptions: QueryOptionFactory<Ip[]>;
	charactersQueryOptions: QueryOptionFactory<Character[]>;
	authorsQueryOptions: QueryOptionFactory<Author[]>;
	enableVirtualization?: boolean;
	moveCopyDialogComponent: SourceMediaScreenProps["moveCopyDialogComponent"];
	uploadModalComponent: SourceMediaScreenProps["uploadModalComponent"];
	renderItem: SourceMediaScreenProps["renderItem"];
	renderMediaPreview?: SourceMediaScreenProps["renderMediaPreview"];
	onOpenMediaDetail?: SourceMediaScreenProps["onOpenMediaDetail"];
	onPrepareMediaDetail?: SourceMediaScreenProps["onPrepareMediaDetail"];
	onFindSimilar?: (media: Media) => void;
	showOpenInNewTab?: boolean;
	onToggleSelect?: (mediaId: string) => void;
	onSelectMedia?: (mediaId: string, mode: MediaCollectionSelectionMode) => void;
	onVisibleMediaIdsChange?: (mediaIds: readonly string[]) => void;
	isBulkSelectMode?: () => boolean;
	isSelected?: (mediaId: string) => boolean;
	onBulkAction?: () => void;
	onClearSelection?: () => void;
	selectedCount?: () => number;
	onEnterBulkSelectMode?: () => void;
	persistenceSurface?: SearchPersistenceSurface;
	searchHistoryClient: SearchHistoryClient;
	/** The route owns the presentation surface (legacy, v2, or another host). */
	screenComponent: Component<SourceMediaScreenProps>;
	scrollContainerSelector?: string;
};

export function SourceMediaPage(props: SourceMediaPageProps): JSX.Element {
	const queryClient = useQueryClient();
	const searchHistory = useSearchHistoryPersistence(props.mediaSourceId, {
		client: props.searchHistoryClient,
		surface: props.persistenceSurface,
	});
	const isSearchStateRestored = searchHistory.isRestored;

	const tags = createQuery<TagResponse[]>(
		clientOnlyQueryOptions(props.tagsQueryOptions),
	);
	const allProjects = createQuery<Project[]>(
		clientOnlyQueryOptions(props.projectsQueryOptions),
	);
	const allIps = createQuery<Ip[]>(
		clientOnlyQueryOptions(props.ipsQueryOptions),
	);
	const allCharacters = createQuery<Character[]>(
		clientOnlyQueryOptions(props.charactersQueryOptions),
	);
	const allAuthors = createQuery<Author[]>(
		clientOnlyQueryOptions(props.authorsQueryOptions),
	);

	const page = useSourceMediaPage({
		mediaSourceId: props.mediaSourceId,
		queries: {
			tags: () => tags.data,
			projects: () => allProjects.data,
			ips: () => allIps.data,
			characters: () => allCharacters.data,
			authors: () => allAuthors.data,
		},
		queryStates: () => ({
			tags: toQueryUiState(tags, {
				isEmpty: (data) => data.length === 0,
			}),
			projects: toQueryUiState(allProjects, {
				isEmpty: (data) => data.length === 0,
			}),
			ips: toQueryUiState(allIps, {
				isEmpty: (data) => data.length === 0,
			}),
			characters: toQueryUiState(allCharacters, {
				isEmpty: (data) => data.length === 0,
			}),
			authors: toQueryUiState(allAuthors, {
				isEmpty: (data) => data.length === 0,
			}),
		}),
		actions: props.actions,
		queryClient,
		presetClient: props.presetClient,
		transport: props.transport,
		getSearchCondition: props.getSearchCondition,
		sortBy: props.sortBy,
		sortOrder: props.sortOrder,
		onThumbnailReady: props.onThumbnailReady,
		isSearchStateRestored,
		commitSearchHistory: searchHistory.commitNow,
		enableVirtualization: props.enableVirtualization,
		scrollContainerSelector: props.scrollContainerSelector,
		historyEntryKey: searchHistory.historyEntryKey,
	});

	const renderActions: SourceMediaScreenProps["renderActions"] = (actions) => (
		<MediaListActions
			onDumpDownload={page.handleDumpDownload}
			onOpenMobileFilters={actions.onOpenMobileFilters}
		/>
	);
	const Screen = props.screenComponent;
	createEffect(() => {
		props.onVisibleMediaIdsChange?.(
			page.mediaResults().map((media) => media.id),
		);
	});

	return (
		<Screen
			enableVirtualization={props.enableVirtualization}
			mediaSourceName={props.mediaSourceName}
			onRetryFilters={async () => {
				await Promise.all([
					tags.refetch(),
					allProjects.refetch(),
					allIps.refetch(),
					allCharacters.refetch(),
					allAuthors.refetch(),
				]);
			}}
			page={page}
			renderActions={renderActions}
			renderItem={props.renderItem}
			onOpenMediaDetail={props.onOpenMediaDetail}
			onPrepareMediaDetail={props.onPrepareMediaDetail}
			onFindSimilar={props.onFindSimilar}
			renderMediaPreview={props.renderMediaPreview}
			moveCopyDialogComponent={props.moveCopyDialogComponent}
			uploadModalComponent={props.uploadModalComponent}
			showOpenInNewTab={props.showOpenInNewTab}
			onToggleSelect={props.onToggleSelect}
			onSelectMedia={props.onSelectMedia}
			isBulkSelectMode={props.isBulkSelectMode}
			isSelected={props.isSelected}
			onBulkAction={props.onBulkAction}
			onClearSelection={props.onClearSelection}
			selectedCount={props.selectedCount}
			onEnterBulkSelectMode={props.onEnterBulkSelectMode}
		/>
	);
}
