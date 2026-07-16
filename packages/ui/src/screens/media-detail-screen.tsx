import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type {
	MediaChangedEvent,
	MediaDeletedEvent,
	ThumbnailGeneratedEvent,
} from "@solid-imager/core/domain/sources/events";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { type JSX, Match, Switch } from "solid-js";
import { ErrorState, OfflineState, QueryStatus } from "../async-state";
import {
	type MediaSourceEventTransport,
	useMediaSourceEvents,
} from "../hooks/use-media-source-events";
import { toQueryUiState } from "../query-state";
import { LoadingRegion, MediaDetailSkeleton } from "../skeleton";

export type MediaDetailScreenProps = {
	mediaSourceId: string;
	mediaId: string;
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
};

export function MediaDetailScreen(props: MediaDetailScreenProps) {
	const queryClient = useQueryClient();

	const mediaDetails = createQuery<MediaDetails>(() =>
		props.mediaDetailsQueryOptions(props.mediaSourceId, props.mediaId),
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
				props.mediaSourceId,
				props.mediaId,
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
				data.mediaId === props.mediaId ||
				data.filePath === mediaDetails.data?.filePath
			) {
				void handleUpdate();
			}
		},
		onMediaChanged: (data: MediaChangedEvent) => {
			if (
				data.mediaId === props.mediaId ||
				data.filePath === mediaDetails.data?.filePath
			) {
				void handleUpdate();
			}
		},
		onThumbnailGenerated: (data: ThumbnailGeneratedEvent) => {
			if (data.mediaId === props.mediaId) {
				void handleUpdate();
			}
		},
	});

	return (
		<div class="container mx-auto px-3 py-4 sm:p-4">
			<QueryStatus
				fetchState={state().fetchState}
				hasData={state().data !== undefined}
				offlineLabel="オフラインのため保存済みデータを表示しています"
				updatingLabel="メディア情報を更新中..."
			/>
			<Switch>
				<Match when={state().data}>
					{(details) => (
						<div class="flex flex-col gap-4 lg:h-[calc(100dvh-5rem)] lg:flex-row">
							<div class="aspect-[4/3] min-h-64 min-w-0 overflow-hidden rounded-lg lg:aspect-auto lg:min-h-0 lg:flex-1">
								{props.renderMediaViewer(details(), props.sourceRootPath)}
							</div>
							<div class="min-w-0 shrink-0 lg:w-96 lg:max-w-[40%]">
								{props.renderMediaSidebar(
									details(),
									mediaDetails.isRefetching,
									handleUpdate,
									props.sourceRootPath,
								)}
							</div>
						</div>
					)}
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
					<LoadingRegion label="メディア情報を読み込んでいます...">
						<MediaDetailSkeleton />
					</LoadingRegion>
				</Match>
			</Switch>
		</div>
	);
}
