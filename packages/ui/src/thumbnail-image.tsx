import { createEffect, createSignal, onCleanup, Show } from "solid-js";

export interface ThumbnailSource {
	getUrl(): string | Promise<string>;
	getSrcSet?(): string | undefined | Promise<string | undefined>;
	onError?(): void;
	onLoad?(): void;
	subscribe?(callback: () => void): () => void;
}

export interface ThumbnailImageProps {
	alt: string;
	class?: string;
	enabled?: boolean;
	fallback?: string;
	fetchpriority?: "high" | "low" | "auto";
	height?: number | null;
	loading?: "eager" | "lazy";
	sizes?: string;
	source: ThumbnailSource;
	width?: number | null;
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const [url, setUrl] = createSignal<string | null>(null);
	const [srcSet, setSrcSet] = createSignal<string | undefined>();
	const [error, setError] = createSignal(false);
	let previousSource: ThumbnailSource | undefined;

	createEffect(() => {
		const source = props.source;
		if (source !== previousSource) {
			previousSource = source;
			setUrl(null);
			setSrcSet(undefined);
			setError(false);
		}
		if (props.enabled === false) {
			return;
		}
		setError(false);
		let cancelled = false;

		const applyResolvedUrl = (resolved: string) => {
			if (!cancelled) {
				setUrl(resolved);
			}
		};

		const load = () => {
			try {
				const resolved = source.getUrl();
				if (typeof resolved === "string") {
					applyResolvedUrl(resolved);
					return;
				}
				void resolved.then(applyResolvedUrl).catch(() => {
					if (!cancelled) {
						setError(true);
						source.onError?.();
					}
				});
			} catch {
				if (!cancelled) {
					setError(true);
					source.onError?.();
				}
			}
		};
		const loadSrcSet = () => {
			try {
				const resolved = source.getSrcSet?.();
				if (typeof resolved === "string" || resolved === undefined) {
					if (!cancelled) setSrcSet(resolved);
					return;
				}
				void resolved.then((value) => {
					if (!cancelled) setSrcSet(value);
				});
			} catch {
				if (!cancelled) setSrcSet(undefined);
			}
		};

		load();
		loadSrcSet();

		const unsubscribe = source.subscribe?.(() => {
			setError(false);
			load();
			loadSrcSet();
		});

		onCleanup(() => {
			cancelled = true;
			unsubscribe?.();
		});
	});

	const handleLoad = () => {
		props.source.onLoad?.();
	};

	const handleError = () => {
		setError(true);
		props.source.onError?.();
		const currentUrl = url();
		void (async () => {
			try {
				const resolved = await props.source.getUrl();
				if (resolved === currentUrl) {
					return;
				}
				setUrl(resolved);
				setError(false);
			} catch {
				// keep error state
			}
		})();
	};

	return (
		<Show
			fallback={
				<div class="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
					{props.fallback ?? props.alt}
				</div>
			}
			when={!error() ? url() : undefined}
		>
			{(resolvedUrl) => (
				<img
					alt={props.alt}
					class={props.class}
					fetchpriority={props.fetchpriority}
					height={props.height ?? undefined}
					loading={props.loading}
					onError={handleError}
					onLoad={handleLoad}
					sizes={srcSet() ? props.sizes : undefined}
					src={resolvedUrl()}
					srcset={srcSet()}
					width={props.width ?? undefined}
				/>
			)}
		</Show>
	);
}
