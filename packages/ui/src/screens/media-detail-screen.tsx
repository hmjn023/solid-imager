import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type {
	MediaChangedEvent,
	MediaDeletedEvent,
	ThumbnailGeneratedEvent,
} from "@solid-imager/core/domain/sources/events";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { type JSX, Match, Switch } from "solid-js";
import {
	type MediaSourceEventTransport,
	useMediaSourceEvents,
} from "../hooks/use-media-source-events";
import { sourceMediaQueryKeys } from "../query-options";
import { toQueryUiState } from "../query-state";

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
		onMediaAdded: () => {
			void queryClient.invalidateQueries({
				queryKey: sourceMediaQueryKeys.forSource(props.mediaSourceId),
			});
		},
		onMediaDeleted: (data: MediaDeletedEvent) => {
			void queryClient.invalidateQueries({
				queryKey: sourceMediaQueryKeys.forSource(props.mediaSourceId),
			});
			if (
				data.mediaId === props.mediaId ||
				data.filePath === mediaDetails.data?.filePath
			) {
				void handleUpdate();
			}
		},
		onMediaChanged: (data: MediaChangedEvent) => {
			void queryClient.invalidateQueries({
				queryKey: sourceMediaQueryKeys.forSource(props.mediaSourceId),
			});
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
		<div class="container mx-auto p-4">
			<Switch>
				<Match when={state().fetchState === "background-fetching"}>
					<p class="mb-2 text-muted-foreground text-sm" role="status">
						メディア情報を更新中...
					</p>
				</Match>
				<Match
					when={state().fetchState === "paused" && state().data !== undefined}
				>
					<p class="mb-2 text-muted-foreground text-sm" role="status">
						オフラインのため保存済みデータを表示しています
					</p>
				</Match>
			</Switch>
			<Switch>
				<Match when={state().data}>
					{(details) => (
						<div class="flex h-[calc(100vh-80px)] flex-col gap-4 lg:flex-row">
							<div class="flex-grow">
								{props.renderMediaViewer(details(), props.sourceRootPath)}
							</div>
							<div class="w-full shrink-0 lg:w-96">
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
					<div class="text-muted-foreground">
						Offline. Media details will load after reconnecting.
					</div>
				</Match>
				<Match when={state().phase === "error"}>
					<div class="text-red-500">Error: {errorMessage()}</div>
				</Match>
				<Match when={state().phase === "pending"}>
					<div class="text-muted-foreground">Loading media details...</div>
				</Match>
			</Switch>
		</div>
	);
}
