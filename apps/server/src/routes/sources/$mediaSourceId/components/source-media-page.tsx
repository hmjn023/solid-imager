import { Button } from "@solid-imager/ui/button";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SourceMediaPage as SourceMediaPageComponent } from "@solid-imager/ui/source-media-page";
import { useQueryClient } from "@tanstack/solid-query";
import { useParams } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { BulkActionDialog } from "~/components/media/bulk-action-dialog";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
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
	tagsQueryOptions,
} from "~/infrastructure/api-clients/queries";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import {
	fetchSourceDump,
	importSourceZip,
	restoreSource,
} from "~/infrastructure/api-clients/sources-api";
import {
	getSearchCondition,
	searchState,
} from "~/presentation/store/search-store";

const PresetClient = createPresetClient(rawPresetClient);

export function SourceMediaPage() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const mediaSourceId = () => params().mediaSourceId;
	const queryClient = useQueryClient();

	const transport = createServerTransport(mediaSourceId);

	// 一括選択用シグナル
	const [isBulkSelectMode, setIsBulkSelectMode] = createSignal(false);
	const [selectedMediaIds, setSelectedMediaIds] = createSignal<string[]>([]);
	const [isBulkActionOpen, setIsBulkActionOpen] = createSignal(false);

	const handleToggleSelect = (mediaId: string) => {
		setIsBulkSelectMode(true);
		setSelectedMediaIds((prev) =>
			prev.includes(mediaId)
				? prev.filter((id) => id !== mediaId)
				: [...prev, mediaId],
		);
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
			queryKey: ["media", mediaSourceId()],
		});
	};

	return (
		<>
			<SourceMediaPageComponent
				enableVirtualization
				mediaSourceId={mediaSourceId}
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
				renderItem={(media, options) => (
					<MediaGridItem
						media={media}
						onContextMenu={options.onContextMenu}
						isBulkSelectMode={options.isBulkSelectMode}
						isSelected={options.isSelected}
						onToggleSelect={() => handleToggleSelect(media.id)}
					/>
				)}
				moveCopyDialogComponent={MoveCopyMediaDialog}
				uploadModalComponent={UploadMediaModal}
				showOpenInNewTab
			/>

			{/* 一括選択ツールバー */}
			<Show when={isBulkSelectMode() && selectedMediaIds().length > 0}>
				<div class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 border border-primary/20 bg-background/95 px-6 py-3 shadow-lg backdrop-blur rounded-full">
					<span class="font-medium text-sm">
						{selectedMediaIds().length} 件選択中
					</span>
					<Button onClick={() => setIsBulkActionOpen(true)} size="sm">
						一括操作を実行
					</Button>
					<Button onClick={handleCancelSelect} variant="outline" size="sm">
						解除
					</Button>
				</div>
			</Show>

			{/* 一括操作ダイアログ */}
			<BulkActionDialog
				open={isBulkActionOpen()}
				onOpenChange={setIsBulkActionOpen}
				mediaSourceId={mediaSourceId() || ""}
				mediaIds={selectedMediaIds()}
				onSuccess={handleBulkSuccess}
			/>
		</>
	);
}
