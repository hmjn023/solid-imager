import { MediaDetailHeader } from "@solid-imager/ui/media-detail-header";
import { MediaDetailScreen } from "@solid-imager/ui/screens/media-detail-screen";
import { createQuery } from "@tanstack/solid-query";
import { type Accessor, Show } from "solid-js";
import { MediaActions } from "~/components/media/media-actions";
import { MediaSidebar } from "~/components/media/media-sidebar";
import { MediaViewer } from "~/components/media/media-viewer";
import { createServerTransport } from "~/hooks/use-media-source-events";
import {
	mediaDetailsQueryOptions,
	mediaSourcesQueryOptions,
} from "~/infrastructure/api-clients/queries";

export function MediaDetailPage(props: {
	mediaId: Accessor<string>;
	mediaSourceId: Accessor<string>;
}) {
	const routeKey = () => `${props.mediaSourceId()}:${props.mediaId()}`;
	return (
		<Show keyed when={routeKey()}>
			{(key) => {
				const [mediaSourceId, mediaId] = key.split(":");
				return (
					<MediaContent
						mediaId={() => mediaId}
						mediaSourceId={() => mediaSourceId}
					/>
				);
			}}
		</Show>
	);
}

function MediaContent(props: {
	mediaId: Accessor<string>;
	mediaSourceId: Accessor<string>;
}) {
	const mediaSources = createQuery(mediaSourcesQueryOptions);
	const sourceName = () =>
		mediaSources.data?.find((source) => source.id === props.mediaSourceId())
			?.name ?? "Media source";

	return (
		<MediaDetailScreen
			mediaDetailsQueryOptions={mediaDetailsQueryOptions}
			mediaId={props.mediaId}
			mediaSourceId={props.mediaSourceId}
			renderHeader={(media, _isUpdating, onUpdate) => (
				<MediaDetailHeader
					media={media}
					onUpdate={() => void onUpdate()}
					renderActions={(actionMedia, actionOnUpdate) => (
						<MediaActions media={actionMedia} onUpdate={actionOnUpdate} />
					)}
					sourceName={sourceName()}
				/>
			)}
			renderMediaSidebar={(media, isUpdating, onUpdate) => (
				<MediaSidebar
					isUpdating={isUpdating}
					media={media}
					onUpdate={onUpdate}
				/>
			)}
			renderMediaViewer={(media) => <MediaViewer media={media} />}
			transport={createServerTransport(props.mediaSourceId)}
		/>
	);
}
