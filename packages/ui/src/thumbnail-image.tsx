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
	let loadGeneration = 0;

	createEffect(() => {
		const source = props.source;
		++loadGeneration;
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
		const isCurrent = (generation: number) =>
			!cancelled && generation === loadGeneration;

		const applyResolvedUrl = (resolved: string, generation: number) => {
			if (isCurrent(generation)) {
				setUrl(resolved);
			}
		};

		const load = () => {
			if (cancelled) return;
			const generation = ++loadGeneration;
			try {
				const resolved = source.getUrl();
				if (typeof resolved === "string") {
					applyResolvedUrl(resolved, generation);
					return;
				}
				void resolved
					.then((value) => applyResolvedUrl(value, generation))
					.catch(() => {
						if (isCurrent(generation)) {
							setError(true);
							source.onError?.();
						}
					});
			} catch {
				if (isCurrent(generation)) {
					setError(true);
					source.onError?.();
				}
			}
		};
		const loadSrcSet = () => {
			const generation = loadGeneration;
			try {
				const resolved = source.getSrcSet?.();
				if (typeof resolved === "string" || resolved === undefined) {
					if (isCurrent(generation)) setSrcSet(resolved);
					return;
				}
				void resolved.then((value) => {
					if (isCurrent(generation)) setSrcSet(value);
				});
			} catch {
				if (isCurrent(generation)) setSrcSet(undefined);
			}
		};

		load();
		loadSrcSet();

		const unsubscribe = source.subscribe?.(() => {
			if (cancelled) return;
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
		const source = props.source;
		const generation = ++loadGeneration;
		setError(true);
		source.onError?.();
		const currentUrl = url();
		void (async () => {
			try {
				const resolved = await source.getUrl();
				if (
					generation !== loadGeneration ||
					source !== props.source ||
					resolved === currentUrl
				) {
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
