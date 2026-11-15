import { t } from "@solid-imager/i18n";
import type { Media } from "@solid-imager/core/media";
import { Button } from "@solid-imager/ui/button";
import {
	type MediaCollectionSelectionMode,
	useMediaCollectionSelection,
} from "@solid-imager/ui/collections";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { sourceMediaQueryKeys } from "@solid-imager/ui/query";
import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import type { SearchHistoryClient } from "@solid-imager/ui/search/history";
import {
	SourceMediaPage as SourceMediaPageComponent,
	type SourceMediaPageProps,
} from "@solid-imager/ui/source-media-page";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { useParams } from "@tanstack/solid-router";
import { type Accessor, createSignal, type JSX, onMount, Show } from "solid-js";
import { BulkActionDialog } from "~/components/media/bulk-action-dialog";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { createServerTransport } from "~/hooks/use-media-source-events";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";
import { startDownloadJobs } from "~/infrastructure/api-clients/downloads-api";
import {
	copyMedia,
	deleteMedia,
	moveMedia,
	syncMediaItems,
	uploadMedia,
} from "~/infrastructure/api-clients/media-api";
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
	searchSemantic,
	searchSimilar,
} from "~/infrastructure/api-clients/search-api";
import { getSearchCondition, searchState } from "@solid-imager/ui/search/state";

const PresetClient = createPresetClient(rawPresetClient);
export type SourceMediaPageControllerProps = {
	mediaSourceId?: Accessor<string>;
	uploadModalComponent: SourceMediaPageProps["uploadModalComponent"];
	searchHistoryClient: SearchHistoryClient;
	renderItem: SourceMediaGridRenderer;
	bulkActionsClass: string;
	ssrGuard?: boolean;
	scrollContainerSelector?: Accessor<string>;
	onOpenMediaDetail?: SourceMediaPageProps["onOpenMediaDetail"];
	onPrepareMediaDetail?: SourceMediaPageProps["onPrepareMediaDetail"];
	onFindSimilar?: SourceMediaPageProps["onFindSimilar"];
	renderMediaPreview?: SourceMediaPageProps["renderMediaPreview"];
};

type SourceMediaGridOptions = Parameters<SourceMediaPageProps["renderItem"]>[1];

type SourceMediaGridRenderer = (
	media: Media,
	options: SourceMediaGridOptions,
	onToggleSelect: () => void,
) => JSX.Element;

export function SourceMediaPageController(
	props: SourceMediaPageControllerProps,
) {
	const params = useParams({ strict: false });
	const mediaSourceId = () => props.mediaSourceId?.() ?? params().mediaSourceId;
	const queryClient = useQueryClient();
	const [isMounted, setIsMounted] = createSignal(false);
	const [visibleMediaIds, setVisibleMediaIds] = createSignal<readonly string[]>(
		[],
	);
	const mediaSources = createQuery(mediaSourcesQueryOptions);
	const mediaSourceName = () =>
		mediaSources.data?.find((source) => source.id === mediaSourceId())?.name;

	const transport = createServerTransport(mediaSourceId);

	// 一括選択用シグナル
	const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
	const selection = useMediaCollectionSelection(visibleMediaIds);
	const selectedMediaIds = () => [...selection.selectedIds()];
	const [isBulkActionOpen, setIsBulkActionOpen] = createSignal(false);

	const handleToggleSelect = (mediaId: string) => {
		setIsBulkSelectMode(true);
		selection.select(mediaId, "toggle");
	};
	const handleSelectionGesture = (
		mediaId: string,
		mode: MediaCollectionSelectionMode,
	) => {
		setIsBulkSelectMode(true);
		selection.select(mediaId, mode);
	};

	const isSelected = selection.isSelected;

	const handleCancelSelect = () => {
		setIsBulkSelectMode(false);
		selection.clear();
	};

	// 一括操作成功時のコールバック
	const handleBulkSuccess = (partial: boolean, succeededMediaIds: string[]) => {
		for (const id of succeededMediaIds) {
			if (selection.isSelected(id)) selection.select(id, "toggle");
		}
		if (!partial && selection.selectedIds().size === 0)
			setIsBulkSelectMode(false);
		void queryClient.invalidateQueries({
			queryKey: sourceMediaQueryKeys.forSource(mediaSourceId()),
		});
	};

	onMount(() => {
		setIsMounted(true);
	});

	return (
		<Show
			fallback={
				<RouteDataPendingScreen
					description={t("sourceMediaScreen.loadingMediaList")}
					layout="media-grid"
					showAction
					title={t("sourceMediaScreen.mediaList")}
				/>
			}
			when={props.ssrGuard === true || isMounted()}
		>
			<SourceMediaPageComponent
				enableVirtualization
				mediaSourceId={mediaSourceId}
				mediaSourceName={mediaSourceName}
				searchHistoryClient={props.searchHistoryClient}
				transport={transport}
				presetClient={PresetClient}
				actions={{
					searchMedia,
					searchSemantic,
					searchSimilar,
					uploadMedia: (sourceId, file, opts) =>
						uploadMedia(sourceId, file, opts),
					deleteMedia,
					copyMedia,
					moveMedia,
					syncMediaItems,
					startDownloadJobs,
				}}
				getSearchCondition={getSearchCondition}
				sortBy={() => searchState.sortBy}
				sortOrder={() => searchState.sortOrder}
				tagsQueryOptions={tagsQueryOptions}
				projectsQueryOptions={allProjectsQueryOptions}
				ipsQueryOptions={allIpsQueryOptions}
				charactersQueryOptions={allCharactersQueryOptions}
				authorsQueryOptions={allAuthorsQueryOptions}
				onToggleSelect={handleToggleSelect}
				onSelectMedia={handleSelectionGesture}
				onVisibleMediaIdsChange={setVisibleMediaIds}
				isBulkSelectMode={isBulkSelectMode}
				isSelected={isSelected}
				onBulkAction={() => setIsBulkActionOpen(true)}
				onClearSelection={handleCancelSelect}
				selectedCount={() => selectedMediaIds().length}
				onEnterBulkSelectMode={() => setIsBulkSelectMode(true)}
				scrollContainerSelector={props.scrollContainerSelector?.()}
				renderItem={(media, options) =>
					props.renderItem(media, options, () => handleToggleSelect(media.id))
				}
				onOpenMediaDetail={props.onOpenMediaDetail}
				onPrepareMediaDetail={props.onPrepareMediaDetail}
				onFindSimilar={props.onFindSimilar}
				renderMediaPreview={props.renderMediaPreview}
				moveCopyDialogComponent={MoveCopyMediaDialog}
				uploadModalComponent={props.uploadModalComponent}
				showOpenInNewTab
			/>

			{/* 一括選択ツールバー */}
			<Show when={isBulkSelectMode()}>
				<div class={props.bulkActionsClass} data-testid="bulk-actions-bar">
					<span class="w-full text-center font-medium text-sm sm:w-auto">
						{t("searchScreen.valueSelected", {
							value0: String(selectedMediaIds().length),
						})}
					</span>
					<Button
						class="flex-1 sm:flex-none"
						disabled={
							visibleMediaIds().length === 0 ||
							selectedMediaIds().length === visibleMediaIds().length
						}
						onClick={() => selection.selectAll()}
						variant="outline"
					>
						{t("searchScreen.selectAllLoadedItems")}
					</Button>
					<Button
						class="flex-1 sm:flex-none"
						disabled={selectedMediaIds().length === 0}
						onClick={() => setIsBulkActionOpen(true)}
					>
						{t("searchScreen.runBulkAction")}
					</Button>
					<Button
						class="flex-1 sm:flex-none"
						onClick={handleCancelSelect}
						variant="outline"
					>
						{t("actions.clearSelection")}
					</Button>
				</div>
			</Show>

			{/* 一括操作ダイアログ */}
			<BulkActionDialog
				open={isBulkActionOpen()}
				onOpenChange={setIsBulkActionOpen}
				mediaSourceId={mediaSourceId()}
				mediaIds={selectedMediaIds()}
				onSuccess={handleBulkSuccess}
			/>
		</Show>
	);
}
