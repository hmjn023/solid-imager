import { Match, Switch } from "solid-js";
import type { MockMedia } from "../../mocks/demo-data";

type MediaViewerProps = {
	media: MockMedia;
};

export function MediaViewer(props: MediaViewerProps) {
	return (
		<div class="flex h-full w-full items-center justify-center bg-black/5">
			<Switch>
				<Match when={props.media.mediaType === "video"}>
					<div class="flex h-full max-h-full w-full items-center justify-center rounded-lg bg-slate-900 text-white">
						Video preview placeholder
					</div>
				</Match>
				<Match when={props.media.mediaType === "audio"}>
					<div class="rounded-lg bg-slate-900 px-8 py-6 text-white">
						Audio preview placeholder
					</div>
				</Match>
				<Match when={true}>
					<div
						class="flex h-full w-full items-center justify-center rounded-lg border text-white"
						style={{
							background:
								"linear-gradient(135deg, rgba(15,23,42,0.18), rgba(15,23,42,0.02)), linear-gradient(135deg, #0f766e, #60a5fa)",
						}}
					>
						<div class="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm uppercase tracking-[0.35em]">
							{props.media.fileName}
						</div>
					</div>
				</Match>
			</Switch>
		</div>
	);
}
