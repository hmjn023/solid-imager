import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type {
	MediaChangedEvent,
	MediaDeletedEvent,
	ThumbnailGeneratedEvent,
} from "@solid-imager/core/domain/sources/events";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import {
	type Accessor,
	getOwner,
	type JSX,
	Match,
	runWithOwner,
	Show,
	Switch,
} from "solid-js";
import { ErrorState, OfflineState, QueryStatus } from "../async-state";
import {
	type MediaSourceEventTransport,
	useMediaSourceEvents,
} from "../hooks/use-media-source-events";
import { toQueryUiState } from "../query-state";
import { LoadingRegion, MediaDetailSkeleton } from "../skeleton";

export type MediaDetailScreenProps = {
	variant?: "default" | "v2";
	mediaSourceId: Accessor<string>;
	mediaId: Accessor<string>;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	mediaDetailsQueryOptions: (mediaSourceId: string, mediaId: string) => any;
	sourceRootPath?: string;
	onAdditionalInvalidate?: () => Promise<void>;
	transport: MediaSourceEventTransport;
	renderMediaViewer: (
		media: MediaDetails,
		sourceRootPath?: string,
	) => JSX.Element;
	renderMediaSidebar: (
		media: MediaDetails,
		isUpdating: boolean,
		onUpdate: () => void,
		sourceRootPath?: string,
	) => JSX.Element;
	renderHeader?: (
		media: MediaDetails,
		isUpdating: boolean,
		onUpdate: () => void,
		sourceRootPath?: string,
	) => JSX.Element;
};

export function MediaDetailScreen(props: MediaDetailScreenProps) {
	const queryClient = useQueryClient();
	const owner = getOwner();
	const renderOwned = (render: () => JSX.Element) =>
		owner ? runWithOwner(owner, render) : render();

	const mediaDetails = createQuery<MediaDetails>(() =>
		props.mediaDetailsQueryOptions(props.mediaSourceId(), props.mediaId()),
	);
	const state = () => toQueryUiState(mediaDetails);
	const errorMessage = () => {
		const error = state().error;
		return error instanceof Error
			? error.message
			: "Failed to load media details";
	};

	const handleUpdate = async () => {
		await queryClient.invalidateQueries({
			queryKey: props.mediaDetailsQueryOptions(
				props.mediaSourceId(),
				props.mediaId(),
			).queryKey,
		});
		if (props.onAdditionalInvalidate) {
			await props.onAdditionalInvalidate();
		}
	};

	useMediaSourceEvents({
		transport: props.transport,
		onMediaDeleted: (data: MediaDeletedEvent) => {
			if (
				data.mediaId === props.mediaId() ||
				data.filePath === mediaDetails.data?.filePath
			) {
				void handleUpdate();
			}
		},
		onMediaChanged: (data: MediaChangedEvent) => {
			if (
				data.mediaId === props.mediaId() ||
				data.filePath === mediaDetails.data?.filePath
			) {
				void handleUpdate();
			}
		},
		onThumbnailGenerated: (data: ThumbnailGeneratedEvent) => {
			if (data.mediaId === props.mediaId()) {
				void handleUpdate();
			}
		},
	});

	return (
		<div
			class={
				props.variant === "v2"
					? "flex h-full min-h-0 w-full flex-col bg-[var(--v2-canvas)]"
					: "mx-auto w-full px-3 py-4 sm:px-4 lg:container lg:p-4"
			}
		>
			<QueryStatus
				fetchState={state().fetchState}
				hasData={state().data !== undefined}
				offlineLabel="オフラインのため保存済みデータを表示しています"
				updatingLabel="メディア情報を更新中..."
			/>
			<Switch>
				<Match when={state().phase === "data"}>
					<Show keyed when={state().data}>
						{(details) => (
							<Show
								fallback={
									<div class="flex flex-col gap-4 lg:h-[calc(100dvh-7.5rem)] lg:flex-row">
										<div class="min-h-64 min-w-0 overflow-hidden rounded-lg lg:min-h-0 lg:flex-1">
											{renderOwned(() =>
												props.renderMediaViewer(details, props.sourceRootPath),
											)}
										</div>
										<div class="min-w-0 shrink-0 lg:w-96 lg:max-w-[40%]">
											{renderOwned(() =>
												props.renderMediaSidebar(
													details,
													mediaDetails.isRefetching,
													handleUpdate,
													props.sourceRootPath,
												),
											)}
										</div>
									</div>
								}
								when={props.variant === "v2"}
							>
								<div class="flex min-h-0 flex-1 flex-col">
									{renderOwned(() =>
										props.renderHeader?.(
											details,
											mediaDetails.isRefetching,
											handleUpdate,
											props.sourceRootPath,
										),
									)}
									<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden [scrollbar-gutter:stable]">
										<div class="min-w-0 lg:min-h-0 lg:overflow-hidden">
											{renderOwned(() =>
												props.renderMediaViewer(details, props.sourceRootPath),
											)}
										</div>
										<div class="min-w-0 border-[var(--v2-border)] border-t lg:min-h-0 lg:border-t-0 lg:border-l">
											{renderOwned(() =>
												props.renderMediaSidebar(
													details,
													mediaDetails.isRefetching,
													handleUpdate,
													props.sourceRootPath,
												),
											)}
										</div>
									</div>
								</div>
							</Show>
						)}
					</Show>
				</Match>
				<Match when={state().phase === "offline"}>
					<OfflineState
						description="接続が戻ったらメディア情報を再取得できます。"
						headingLevel={1}
						onRetry={() => mediaDetails.refetch().then(() => undefined)}
					/>
				</Match>
				<Match when={state().phase === "error"}>
					<ErrorState
						description={errorMessage()}
						headingLevel={1}
						onRetry={() => mediaDetails.refetch().then(() => undefined)}
						title="メディア情報を読み込めませんでした"
					/>
				</Match>
				<Match when={state().phase === "pending"}>
					<LoadingRegion
						class={props.variant === "v2" ? "h-full min-h-0" : undefined}
						label="メディア情報を読み込んでいます..."
					>
						<MediaDetailSkeleton variant={props.variant} />
					</LoadingRegion>
				</Match>
			</Switch>
		</div>
	);
}
