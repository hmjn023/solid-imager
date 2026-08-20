import type { Media } from "@solid-imager/core/domain/media/schemas";
import { Button } from "@solid-imager/ui/button";
import type { SearchPersistenceSurface } from "@solid-imager/ui/hooks/use-current-search-persistence";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { sourceMediaQueryKeys } from "@solid-imager/ui/query-options";
import { RouteDataPendingScreen } from "@solid-imager/ui/router-status";
import type { SourceMediaScreenProps } from "@solid-imager/ui/screens/source-media-screen.types";
import type { SearchHistoryClient } from "@solid-imager/ui/search-history-client";
import { SourceMediaPage as SourceMediaPageComponent } from "@solid-imager/ui/source-media-page";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { useParams } from "@tanstack/solid-router";
import {
	type Accessor,
	type Component,
	createSignal,
	type JSX,
	onMount,
	Show,
} from "solid-js";
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
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import {
	fetchSourceDump,
	importSourceNdjson,
	importSourceZip,
	restoreSource,
} from "~/infrastructure/api-clients/sources-api";
import {
	getSearchCondition,
	searchState,
} from "~/presentation/store/search-store";

const PresetClient = createPresetClient(rawPresetClient);
export type SourceMediaPageControllerProps = {
	mediaSourceId?: Accessor<string>;
	screenComponent: Component<SourceMediaScreenProps>;
	uploadModalComponent: SourceMediaScreenProps["uploadModalComponent"];
	persistenceSurface: SearchPersistenceSurface;
	searchHistoryClient: SearchHistoryClient;
	renderItem: SourceMediaGridRenderer;
	bulkActionsClass: string;
	ssrGuard?: boolean;
	scrollContainerSelector?: Accessor<string>;
	onOpenMediaDetail?: SourceMediaScreenProps["onOpenMediaDetail"];
	onPrepareMediaDetail?: SourceMediaScreenProps["onPrepareMediaDetail"];
	renderMediaPreview?: SourceMediaScreenProps["renderMediaPreview"];
};

type SourceMediaGridOptions = Parameters<
	SourceMediaScreenProps["renderItem"]
>[1];

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
	const mediaSources = createQuery(mediaSourcesQueryOptions);
	const mediaSourceName = () =>
		mediaSources.data?.find((source) => source.id === mediaSourceId())?.name;

	const transport = createServerTransport(mediaSourceId);

	// 一括選択用シグナル
	const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
	const [selectedMediaIds, setSelectedMediaIds] = createSignal<string[]>([]);
	const [isBulkActionOpen, setIsBulkActionOpen] = createSignal(false);

	const handleToggleSelect = (mediaId: string) => {
		setIsBulkSelectMode(true);
		setSelectedMediaIds((prev) => {
			return prev.includes(mediaId)
				? prev.filter((id) => id !== mediaId)
				: [...prev, mediaId];
		});
	};

	const isSelected = (mediaId: string) => selectedMediaIds().includes(mediaId);

	const handleCancelSelect = () => {
		setIsBulkSelectMode(false);
		setSelectedMediaIds([]);
	};

	// 一括操作成功時のコールバック
	const handleBulkSuccess = () => {
		handleCancelSelect();
		queryClient.invalidateQueries({
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
					description="メディア一覧を読み込んでいます..."
					layout="media-grid"
					showAction
					title="メディア一覧"
				/>
			}
			when={props.ssrGuard === true || isMounted()}
		>
			<SourceMediaPageComponent
				enableVirtualization
				mediaSourceId={mediaSourceId}
				mediaSourceName={mediaSourceName}
				persistenceSurface={props.persistenceSurface}
				searchHistoryClient={props.searchHistoryClient}
				transport={transport}
				presetClient={PresetClient}
				actions={{
					searchMedia,
					uploadMedia: (sourceId, file, opts) =>
						uploadMedia(sourceId, file, opts),
					deleteMedia,
					copyMedia,
					moveMedia,
					syncMediaItems,
					startDownloadJobs,
					fetchSourceDump,
					restoreSource,
					importSourceZip,
					importSourceNdjson,
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
				isBulkSelectMode={isBulkSelectMode}
				isSelected={isSelected}
				onBulkAction={() => setIsBulkActionOpen(true)}
				onClearSelection={handleCancelSelect}
				selectedCount={() => selectedMediaIds().length}
				onEnterBulkSelectMode={() => setIsBulkSelectMode(true)}
				screenComponent={props.screenComponent}
				scrollContainerSelector={props.scrollContainerSelector?.()}
				renderItem={(media, options) =>
					props.renderItem(media, options, () => handleToggleSelect(media.id))
				}
				onOpenMediaDetail={props.onOpenMediaDetail}
				onPrepareMediaDetail={props.onPrepareMediaDetail}
				renderMediaPreview={props.renderMediaPreview}
				moveCopyDialogComponent={MoveCopyMediaDialog}
				uploadModalComponent={props.uploadModalComponent}
				showOpenInNewTab
			/>

			{/* 一括選択ツールバー */}
			<Show when={isBulkSelectMode()}>
				<div class={props.bulkActionsClass} data-testid="bulk-actions-bar">
					<span class="w-full text-center font-medium text-sm sm:w-auto">
						{selectedMediaIds().length} 件選択中
					</span>
					<Button
						class="flex-1 sm:flex-none"
						disabled={selectedMediaIds().length === 0}
						onClick={() => setIsBulkActionOpen(true)}
					>
						一括操作を実行
					</Button>
					<Button
						class="flex-1 sm:flex-none"
						onClick={handleCancelSelect}
						variant="outline"
					>
						解除
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
