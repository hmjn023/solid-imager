import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type {
	MediaChangedEvent,
	MediaDeletedEvent,
	ThumbnailGeneratedEvent,
} from "@solid-imager/core/domain/sources/events";
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
			: "Failed to load media details";
	};

	const handleUpdate = async () => {
		await queryClient.invalidateQueries({
			queryKey: props.mediaDetailsQueryOptions(
				props.mediaSourceId(),
				props.mediaId(),
			).queryKey,
		});
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
					offlineLabel="オフラインのため保存済みデータを表示しています"
					updatingLabel="メディア情報を更新中..."
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
					{props.renderPending()}
				</Match>
			</Switch>
		</>
	);
}

export { MediaDetailScreenController };
