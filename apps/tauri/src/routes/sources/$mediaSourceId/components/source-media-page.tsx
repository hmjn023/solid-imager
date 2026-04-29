import {
	type MediaSourceEventTransport,
} from "@solid-imager/ui/hooks/use-media-source-events";
import {
	SourceMediaScreen,
	type SourceMediaScreenProps,
} from "@solid-imager/ui/screens/source-media-screen";
import { useSourceMediaPage } from "@solid-imager/ui/hooks/use-source-media-page";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { useParams } from "@tanstack/solid-router";
import { createMemo } from "solid-js";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
import {
	copyMedia,
	deleteMedia,
	moveMedia,
	syncMediaItems,
	uploadMedia,
	startDownloadJobs,
} from "~/infrastructure/api-clients/media-api";
import { allAuthorsQueryOptions } from "~/infrastructure/api-clients/queries/authors-query";
import { allCharactersQueryOptions } from "~/infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "~/infrastructure/api-clients/queries/ips-query";
import { allProjectsQueryOptions } from "~/infrastructure/api-clients/queries/projects-query";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries/sources-query";
import { tagsQueryOptions } from "~/infrastructure/api-clients/queries/tags-query";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import {
	fetchSourceDump,
	importSourceZip,
	restoreSource,
} from "~/infrastructure/api-clients/sources-api";
import { notifyThumbnailReady } from "~/infrastructure/media/thumbnail-runtime";
import { listen } from "@tauri-apps/api/event";
import {
	getSearchCondition,
	searchState,
} from "~/presentation/store/search-store";
import { MediaListActions } from "./media-list-actions";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { Progress } from "@solid-imager/ui/progress";
import { Show, For } from "solid-js";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@solid-imager/ui/context-menu";
import { createWindowVirtualizer } from "@tanstack/solid-virtual";
import { createSignal, onMount, onCleanup, createEffect } from "solid-js";

function createTauriTransport(
	mediaSourceId: () => string | undefined,
): MediaSourceEventTransport {
	return {
		listen(handler) {
			const id = mediaSourceId();
			if (!id) {
				return () => {
					/* no-op */
				};
			}

			let isCleanedUp = false;

			const EVENT_NAMES = [
				"media-added",
				"media-deleted",
				"media-changed",
				"media-copied",
				"media-moved",
				"thumbnail-generated",
				"all-jobs-completed",
				"watcher-error",
				"job-progress",
			] as const;

			type EventPayload = {
				mediaSourceId?: string;
				sourceId?: string;
				targetId?: string;
				jobId?: string;
			};

			const unlistenPromises = EVENT_NAMES.map((eventName) =>
				listen<EventPayload>(eventName, (event) => {
					if (isCleanedUp) return;

					const payload = event.payload;
					const relevant =
						payload?.mediaSourceId === id ||
						payload?.sourceId === id ||
						payload?.targetId === id ||
						payload?.jobId === id ||
						(payload?.mediaSourceId === undefined &&
							payload?.sourceId === undefined &&
							payload?.targetId === undefined &&
							payload?.jobId === undefined);

					if (relevant) {
						handler(eventName, payload);
					}
				}),
			);

			return () => {
				isCleanedUp = true;
				void Promise.all(unlistenPromises).then((unlistenFns) => {
					for (const unlisten of unlistenFns) {
						unlisten();
					}
				});
			};
		},
	};
}

export function SourceMediaPage() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });
	const mediaSourceId = () => params().mediaSourceId;
	const queryClient = useQueryClient();

	const tags = createQuery(() => tagsQueryOptions());
	const allProjects = createQuery(() => allProjectsQueryOptions());
	const allIps = createQuery(() => allIpsQueryOptions());
	const allCharacters = createQuery(() => allCharactersQueryOptions());
	const allAuthors = createQuery(() => allAuthorsQueryOptions());
	const sources = createQuery(() => mediaSourcesQueryOptions());

	const source = createMemo(() =>
		sources.data?.find((item) => item.id === mediaSourceId()),
	);
	const sourceRootPath = createMemo(() => {
		const current = source();
		if (current?.type !== "local") {
			return undefined;
		}
		const connectionInfo = current.connectionInfo as { path?: string };
		return connectionInfo.path;
	});

	const transport = createTauriTransport(mediaSourceId);

	const page = useSourceMediaPage({
		mediaSourceId,
		queries: {
			tags: () => tags.data,
			projects: () => allProjects.data,
			ips: () => allIps.data,
			characters: () => allCharacters.data,
			authors: () => allAuthors.data,
		},
		actions: {
			searchMedia,
			uploadMedia: (sourceId, file, opts) =>
				uploadMedia(sourceId, file, opts),
			deleteMedia,
			copyMedia,
			moveMedia,
			syncMediaItems,
			startDownloadJobs,
			fetchSourceDump,
			restoreSource: async (sourceId, data) => {
				const result = await restoreSource(sourceId, data);
				return result as { processed: number; skipped: number };
			},
			importSourceZip: async (sourceId, file) => {
				const result = await importSourceZip(sourceId, file);
				return result as { importedCount: number };
			},
		},
		queryClient,
		presetClient: PresetClient,
		transport,
		getSearchCondition,
		sortBy: () => searchState.sortBy,
		sortOrder: () => searchState.sortOrder,
		onThumbnailReady: notifyThumbnailReady,
	});

	// --- Virtual grid setup ---
	const MEDIA_ITEMS_PER_PAGE = 100;
	const GRID_GAP_PX = 16;
	const GRID_ITEM_ASPECT_RATIO = 4 / 3;
	const VIRTUAL_ROWS_OVERSCAN = 4;

	const [windowWidth, setWindowWidth] = createSignal(0);
	const [mediaGridWidth, setMediaGridWidth] = createSignal(0);
	let mediaGridRef: HTMLDivElement | undefined;

	const columnCount = createMemo(() => {
		const width = windowWidth();
		if (width >= 1024) return 5;
		if (width >= 768) return 3;
		return 2;
	});

	const mediaItemWidth = createMemo(() => {
		const width = mediaGridWidth();
		const columns = columnCount();
		if (!(width > 0 && columns > 0)) return 0;
		return Math.max((width - GRID_GAP_PX * (columns - 1)) / columns, 0);
	});

	const mediaItemHeight = createMemo(() => {
		const width = mediaItemWidth();
		if (width <= 0) return 0;
		return width * GRID_ITEM_ASPECT_RATIO;
	});

	const mediaRows = createMemo(() => {
		const results = page.mediaResults();
		const columns = columnCount();
		const rows: (typeof results)[] = [];
		for (let index = 0; index < results.length; index += columns) {
			rows.push(results.slice(index, index + columns));
		}
		return rows;
	});

	const rowCount = createMemo(() => mediaRows().length);

	const mediaRowVirtualizer = createWindowVirtualizer<HTMLDivElement>({
		get count() {
			return rowCount();
		},
		estimateSize: () => mediaItemHeight() || 320,
		gap: GRID_GAP_PX,
		getItemKey: (index) => index,
		overscan: VIRTUAL_ROWS_OVERSCAN,
		scrollMargin: 0,
	});

	const useVirtualGrid = createMemo(
		() =>
			page.mediaResults().length > MEDIA_ITEMS_PER_PAGE &&
			mediaItemWidth() > 0,
	);

	const updateMediaGridMetrics = () => {
		if (!mediaGridRef) return;
		setMediaGridWidth(mediaGridRef.getBoundingClientRect().width);
	};

	onMount(() => {
		setWindowWidth(window.innerWidth);
		updateMediaGridMetrics();

		const handleResize = () => {
			setWindowWidth(window.innerWidth);
			updateMediaGridMetrics();
		};
		window.addEventListener("resize", handleResize);

		const resizeObserver = new ResizeObserver(() => {
			updateMediaGridMetrics();
		});
		if (mediaGridRef) {
			resizeObserver.observe(mediaGridRef);
		}

		onCleanup(() => {
			window.removeEventListener("resize", handleResize);
			resizeObserver.disconnect();
		});
	});

	createEffect(() => {
		rowCount();
		mediaItemHeight();
		columnCount();
		mediaRowVirtualizer.measure();
	});

	createEffect(() => {
		const virtualRows = mediaRowVirtualizer.getVirtualItems();
		const lastRow = virtualRows[virtualRows.length - 1];
		if (!lastRow) return;
		if (
			lastRow.index >= rowCount() - 2 &&
			page.mediaQuery.hasNextPage &&
			!page.mediaQuery.isFetchingNextPage
		) {
			void page.mediaQuery.fetchNextPage();
		}
	});

	// --- Render props ---
	const renderGrid: SourceMediaScreenProps["renderGrid"] = (gridProps) => (
		<div class="min-h-0 space-y-4">
			<div class="mb-4 flex items-center justify-between">
				<p class="text-gray-600 text-sm">
					{page.mediaQuery.data?.pages[0]?.total ?? 0} 件の結果
				</p>
			</div>

			<ContextMenu>
				<ContextMenuTrigger class="block w-full">
					<div
						class="relative w-full"
						ref={(element) => {
							mediaGridRef = element;
							requestAnimationFrame(() => {
								updateMediaGridMetrics();
							});
						}}
						style={{
							height: useVirtualGrid()
								? `${mediaRowVirtualizer.getTotalSize()}px`
								: undefined,
						}}
					>
						<Show
							fallback={
								<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
									<For each={gridProps.mediaResults()}>
										{(media) => (
											<MediaGridItem
												media={media}
												onContextMenu={() =>
													gridProps.setContextMenuMediaId(media.id)
												}
												sourceRootPath={sourceRootPath()}
											/>
										)}
									</For>
								</div>
							}
							when={useVirtualGrid()}
						>
							<For each={mediaRowVirtualizer.getVirtualItems()}>
								{(virtualRow) => {
									const rowMedia = () =>
										mediaRows()[virtualRow.index] || [];
									return (
										<div
											class="absolute left-0 top-0 grid gap-4"
											style={{
												"grid-template-columns": `repeat(${columnCount()}, minmax(0, 1fr))`,
												height: `${virtualRow.size}px`,
												transform: `translateY(${virtualRow.start}px)`,
												width: "100%",
											}}
										>
											<For each={rowMedia()}>
												{(media) => (
													<MediaGridItem
														media={media}
														onContextMenu={() =>
															gridProps.setContextMenuMediaId(
																media.id,
															)
														}
														sourceRootPath={sourceRootPath()}
													/>
												)}
											</For>
										</div>
									);
								}}
							</For>
						</Show>
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<Show
						fallback={
							<ContextMenuItem disabled>
								No media selected
							</ContextMenuItem>
						}
						when={gridProps.contextMenuMediaId()}
					>
						<ContextMenuItem
							onSelect={() => {
								const id = gridProps.contextMenuMediaId();
								if (id) gridProps.onDelete(id);
							}}
						>
							Delete
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem
							onSelect={() => {
								const id = gridProps.contextMenuMediaId();
								if (id) gridProps.onCopyMove(id, "copy");
							}}
						>
							Copy to Source
						</ContextMenuItem>
						<ContextMenuItem
							onSelect={() => {
								const id = gridProps.contextMenuMediaId();
								if (id) gridProps.onCopyMove(id, "move");
							}}
						>
							Move to Source
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem
							onSelect={() => {
								const id = gridProps.contextMenuMediaId();
								if (id) void gridProps.onSyncSingleMedia(id);
							}}
						>
							Sync Metadata
						</ContextMenuItem>
					</Show>
				</ContextMenuContent>
			</ContextMenu>

			<Show when={gridProps.mediaResults().length === 0 && !gridProps.isPending}>
				<div class="py-12 text-center text-gray-500">
					検索結果が見つかりませんでした
				</div>
			</Show>

			<div
				class="flex h-10 w-full items-center justify-center text-gray-500"
				ref={gridProps.setLoadMoreRef}
			>
				<Show when={gridProps.isFetchingNextPage}>Loading more...</Show>
			</div>
		</div>
	);

	const renderActions: SourceMediaScreenProps["renderActions"] = (
		actionProps,
	) => (
		<MediaListActions
			filterPanel={
				<div>Filter panel placeholder</div>
			}
			isSyncDisabled={actionProps.isSyncDisabled}
			isSyncing={actionProps.isSyncing}
			onAddMedia={actionProps.onAddMedia}
			onDumpDownload={() => actionProps.onDumpDownload("json")}
			onRestore={actionProps.onRestore}
			onSyncLoadedMedia={actionProps.onSyncLoadedMedia}
			onZipDumpDownload={() => actionProps.onDumpDownload("zip")}
			sourceDescription={source()?.description}
			sourceName={source()?.name}
		/>
	);

	const renderJobProgress: SourceMediaScreenProps["renderJobProgress"] = (
		progressProps,
	) => (
		<Show when={progressProps.jobProgress()}>
			{(progress) => (
				<div class="mb-4 rounded-md border bg-muted/50 px-4 py-3">
					<div class="mb-2 flex items-center justify-between text-sm">
						<span class="text-muted-foreground">
							サムネイル生成中 {progress().processed} /{" "}
							{progress().total}
						</span>
						<span class="text-muted-foreground text-xs">
							{Math.round(
								(progress().processed / progress().total) * 100,
							)}
							%
						</span>
					</div>
					<Progress
						value={
							(progress().processed / progress().total) * 100
						}
					/>
				</div>
			)}
		</Show>
	);

	return (
		<SourceMediaScreen
			page={page}
			renderActions={renderActions}
			renderGrid={renderGrid}
			renderJobProgress={renderJobProgress}
			renderMoveCopyDialog={() => (
				<MoveCopyMediaDialog
					currentSourceId={mediaSourceId()}
					mode={page.moveCopyMode()}
					onConfirm={page.handleConfirmCopyMove}
					onOpenChange={page.setMoveCopyDialogOpen}
					open={page.moveCopyDialogOpen()}
				/>
			)}
			renderUploadModal={() => (
				<UploadMediaModal
					initialFile={page.fileToUpload()}
					isOpen={page.showUploadModal()}
					onClose={() => {
						page.setShowUploadModal(false);
						page.setFileToUpload(null);
						page.setPastedUrl(null);
					}}
					onUpload={page.handleUpload}
					onUrlFetch={(file) => page.setFileToUpload(file)}
					pastedUrl={page.pastedUrl()}
				/>
			)}
		/>
	);
}
