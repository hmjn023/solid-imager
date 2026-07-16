import {
	createEffect,
	createSignal,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";

export interface MediaSource {
	type: "image" | "video" | "audio";
	getUrl(): string | Promise<string>;
	revokeUrl?(url: string): void;
}

export interface MediaViewerProps {
	source: MediaSource;
	fileName: string;
	width?: number;
	height?: number;
}

export function MediaViewer(props: MediaViewerProps) {
	const [mediaUrl, setMediaUrl] = createSignal<string | null>(null);

	createEffect(() => {
		const source = props.source;
		let currentUrl: string | null = null;
		let disposed = false;

		void (async () => {
			try {
				const url = await source.getUrl();
				if (disposed) {
					source.revokeUrl?.(url);
					return;
				}
				currentUrl = url;
				setMediaUrl(url);
			} catch {
				if (!disposed) {
					setMediaUrl(null);
				}
			}
		})();

		onCleanup(() => {
			disposed = true;
			if (currentUrl && source.revokeUrl) {
				source.revokeUrl(currentUrl);
			}
		});
	});

	return (
		<div class="flex h-full min-h-0 min-w-0 w-full items-center justify-center overflow-hidden rounded-lg bg-black/5 p-2 sm:p-4">
			<Switch>
				<Match when={props.source.type === "video"}>
					<Show
						fallback={
							<div class="flex h-full max-h-full w-full items-center justify-center rounded-lg bg-slate-900 text-white">
								Video preview unavailable
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<video
								class="max-h-full max-w-full rounded-md"
								controls
								src={url()}
							>
								<track kind="captions" />
							</video>
						)}
					</Show>
				</Match>
				<Match when={props.source.type === "audio"}>
					<Show
						fallback={
							<div class="rounded-lg bg-slate-900 px-8 py-6 text-white">
								Audio preview unavailable
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<audio class="max-w-full" controls src={url()}>
								<track kind="captions" />
							</audio>
						)}
					</Show>
				</Match>
				<Match when={true}>
					<Show
						fallback={
							<div
								class="flex h-full w-full items-center justify-center rounded-lg border text-white"
								style={{
									background:
										"linear-gradient(135deg, rgba(15,23,42,0.18), rgba(15,23,42,0.02)), linear-gradient(135deg, #0f766e, #60a5fa)",
								}}
							>
								<div class="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm uppercase tracking-[0.35em]">
									{props.fileName}
								</div>
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<img
								alt={props.fileName}
								class="max-h-full max-w-full rounded-md object-contain"
								height={props.height}
								src={url()}
								width={props.width}
							/>
						)}
					</Show>
				</Match>
			</Switch>
		</div>
	);
}
