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

export function V2MediaViewer(props: MediaViewerProps) {
	const [mediaUrl, setMediaUrl] = createSignal<string | null>(null);

	createEffect(() => {
		const source = props.source;
		let currentUrl: string | null = null;
		let disposed = false;
		setMediaUrl(null);

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
		<div
			class="flex aspect-[var(--media-aspect)] min-h-0 min-w-0 w-full items-center justify-center overflow-hidden bg-[var(--v2-surface)] lg:aspect-auto lg:h-full"
			data-media-viewer
			style={`--media-aspect: ${props.width && props.height ? `${props.width} / ${props.height}` : "4 / 3"}`}
		>
			<Switch>
				<Match when={props.source.type === "video"}>
					<Show
						fallback={
							<div class="flex h-full max-h-full w-full items-center justify-center bg-slate-900 text-white">
								Video preview unavailable
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<video class="h-full max-w-full" controls src={url()}>
								<track kind="captions" />
							</video>
						)}
					</Show>
				</Match>
				<Match when={props.source.type === "audio"}>
					<Show
						fallback={
							<div class="bg-slate-900 px-8 py-6 text-white">
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
							<div class="flex h-full w-full items-center justify-center bg-[var(--v2-surface-muted)] text-[var(--v2-text-muted)]">
								<div class="max-w-[80%] truncate rounded-md border border-current/20 px-4 py-2 text-sm">
									{props.fileName}
								</div>
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<img
								alt={props.fileName}
								class="h-full w-full object-contain"
								fetchpriority="high"
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
