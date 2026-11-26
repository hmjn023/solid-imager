import { t } from "@solid-imager/i18n";
import type { MediaDetails } from "@solid-imager/core/media";
import type {
	MediaChangedEvent,
	MediaDeletedEvent,
	ThumbnailGeneratedEvent,
} from "@solid-imager/core/events";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import {
	createMemo,
	createProjection,
	Match,
	Show,
	Switch,
	untrack,
} from "solid-js";
import { ErrorState, OfflineState, QueryStatus } from "../async-state";
import { useMediaSourceEvents } from "../hooks/use-media-source-events";
import { readQueryData, toQueryUiState } from "../query-state";
import { relatedMediaQueryKeys } from "../query-options/media-query";
import type {
	MediaDetailDataRenderProps,
	MediaDetailScreenProps,
} from "./media-detail-screen.types";

export type MediaDetailScreenControllerProps = MediaDetailScreenProps & {
	renderData: (
		props: MediaDetailDataRenderProps,
	) => import("@solidjs/web").JSX.Element;
	renderPending: () => import("@solidjs/web").JSX.Element;
};

function MediaDetailScreenController(props: MediaDetailScreenControllerProps) {
	const queryClient = useQueryClient();
	const mediaDetails = useQuery<MediaDetails>(() =>
		props.mediaDetailsQueryOptions(props.mediaSourceId(), props.mediaId()),
	);
	const state = createMemo(() => toQueryUiState(mediaDetails));
	const detailState = createProjection<{ details?: MediaDetails }>(
		() => ({
			details: state().data,
		}),
		{},
	);
	const errorMessage = () => {
		const error = state().error;
		return error instanceof Error
			? error.message
			: t("mediaDetailScreenCore.failedToLoadMediaDetails");
	};

	const handleUpdate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: props.mediaDetailsQueryOptions(
					props.mediaSourceId(),
					props.mediaId(),
				).queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: relatedMediaQueryKeys.detail(
					props.mediaSourceId(),
					props.mediaId(),
				),
			}),
		]);
		await props.onAdditionalInvalidate?.();
	};

	useMediaSourceEvents({
		transport: props.transport,
		onMediaDeleted: (data: MediaDeletedEvent) => {
			if (
				data.mediaId === props.mediaId() ||
				data.filePath === readQueryData(mediaDetails)?.filePath
			) {
				void handleUpdate();
			}
		},
		onMediaChanged: (data: MediaChangedEvent) => {
			if (
				data.mediaId === props.mediaId() ||
				data.filePath === readQueryData(mediaDetails)?.filePath
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
		<>
			<Show when={state().data !== undefined}>
				<QueryStatus
					class="mb-2"
					fetchState={state().fetchState}
					hasData
					hideWhenIdle
					offlineLabel={t("sourceMediaScreen.offlineShowingSavedData")}
					updatingLabel={t("mediaDetailScreenCore.updatingMediaDetails")}
				/>
			</Show>
			<Switch>
				<Match when={state().phase === "data"}>
					<Show keyed when={detailState.details?.id}>
						{(mediaId) => {
							// The keyed branch owns this record while its fields reconcile.
							const details = untrack(() => {
								const current = detailState.details;
								return current?.id === mediaId ? current : undefined;
							});
							return (
								details &&
								props.renderData({
									details,
									isUpdating: () => mediaDetails.isRefetching,
									onUpdate: handleUpdate,
									get sourceRootPath() {
										return props.sourceRootPath;
									},
								})
							);
						}}
					</Show>
				</Match>
				<Match when={state().phase === "offline"}>
					<OfflineState
						description={t(
							"mediaDetailScreenCore.reloadMediaDetailsWhenYourConnectionReturns",
						)}
						headingLevel={1}
						onRetry={() => mediaDetails.refetch().then(() => undefined)}
					/>
				</Match>
				<Match when={state().phase === "error"}>
					<ErrorState
						description={errorMessage()}
						headingLevel={1}
						onRetry={() => mediaDetails.refetch().then(() => undefined)}
						title={t("mediaDetailScreenCore.couldNotLoadMediaDetails")}
					/>
				</Match>
				<Match when={state().phase === "pending"}>
					{props.renderPending()}
				</Match>
			</Switch>
		</>
	);
}

export { MediaDetailScreenController };
