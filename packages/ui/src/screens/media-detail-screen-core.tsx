import { t } from "@solid-imager/i18n";
import type { MediaDetails } from "@solid-imager/core/media";
import type {
	MediaChangedEvent,
	MediaDeletedEvent,
	ThumbnailGeneratedEvent,
} from "@solid-imager/core/events";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import {
	createComputed,
	getOwner,
	Match,
	runWithOwner,
	Show,
	Switch,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { ErrorState, OfflineState, QueryStatus } from "../async-state";
import { useMediaSourceEvents } from "../hooks/use-media-source-events";
import { toQueryUiState } from "../query-state";
import { relatedMediaQueryKeys } from "../query-options/media-query";
import type {
	MediaDetailDataRenderProps,
	MediaDetailScreenProps,
} from "./media-detail-screen.types";

export type MediaDetailScreenControllerProps = MediaDetailScreenProps & {
	renderData: (
		props: MediaDetailDataRenderProps,
	) => import("solid-js").JSX.Element;
	renderPending: () => import("solid-js").JSX.Element;
};

function MediaDetailScreenController(props: MediaDetailScreenControllerProps) {
	const queryClient = useQueryClient();
	const owner = getOwner();
	const renderOwned = (render: () => import("solid-js").JSX.Element) =>
		owner ? runWithOwner(owner, render) : render();

	const mediaDetails = createQuery<MediaDetails>(() =>
		props.mediaDetailsQueryOptions(props.mediaSourceId(), props.mediaId()),
	);
	const state = () => toQueryUiState(mediaDetails);
	const [detailState, setDetailState] = createStore<{
		details?: MediaDetails;
	}>({});
	createComputed(() => {
		const details = state().data;
		if (details) {
			setDetailState("details", reconcile(details));
		}
	});
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
							const details = detailState.details;
							return details?.id === mediaId
								? renderOwned(() =>
										props.renderData({
											details,
											isUpdating: () => mediaDetails.isRefetching,
											onUpdate: handleUpdate,
											sourceRootPath: props.sourceRootPath,
										}),
									)
								: null;
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
