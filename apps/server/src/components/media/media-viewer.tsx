import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { useParams } from "@tanstack/solid-router";
import { createMemo, Match, Switch } from "solid-js";

type MediaViewerProps = {
	media: MediaDetails;
};

export default function MediaViewer(props: MediaViewerProps) {
	const params = useParams({ from: "/sources/$mediaSourceId/$mediaId/" });

	const mediaUrl = createMemo(() => `/api/sources/${params().mediaSourceId}/${params().mediaId}`);

	return (
		<div class="flex h-full w-full items-center justify-center bg-black/5">
			<Switch>
				<Match when={props.media.mediaType === "video"}>
					<video
						class="max-h-full max-w-full"
						controls
						height={props.media.height}
						src={mediaUrl()}
						width={props.media.width}
					>
						<track kind="captions" />
						Your browser does not support the video tag.
					</video>
				</Match>
				<Match when={props.media.mediaType === "audio"}>
					<audio controls src={mediaUrl()}>
						<track kind="captions" />
						Your browser does not support the audio tag.
					</audio>
				</Match>
				<Match when={true}>
					<img
						alt={props.media.fileName}
						class="max-h-full max-w-full object-contain"
						height={props.media.height}
						src={mediaUrl()}
						width={props.media.width}
					/>
				</Match>
			</Switch>
		</div>
	);
}
