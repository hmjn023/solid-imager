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
		<div class="flex h-full w-full items-center justify-center bg-black/5">
			<Switch>
				<Match when={props.source.type === "video"}>
					<Show
						fallback={<div class="h-full max-h-full w-full" />}
						when={mediaUrl()}
					>
						{(url) => (
							<video class="max-h-full max-w-full" controls src={url()}>
								<track kind="captions" />
							</video>
						)}
					</Show>
				</Match>
				<Match when={props.source.type === "audio"}>
					<Show fallback={<div />} when={mediaUrl()}>
						{(url) => (
							<audio controls src={url()}>
								<track kind="captions" />
							</audio>
						)}
					</Show>
				</Match>
				<Match when={true}>
					<Show fallback={<div />} when={mediaUrl()}>
						{(url) => (
							<img
								alt={props.fileName}
								class="max-h-full max-w-full object-contain"
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
