import type { JSX } from "@solidjs/web";
import { createSignal, onSettled, Show } from "solid-js";

export interface ThumbnailSource {
	getUrl(): string | Promise<string>;
	getSrcSet?(): string | undefined | Promise<string | undefined>;
	onError?(): void;
	onLoad?(): void;
	subscribe?(callback: () => void): () => void;
}

export interface StaticThumbnailSource {
	url: string;
	srcSet?: string;
	fallbackUrl?: string;
}

export interface ThumbnailImageProps {
	alt: string;
	class?: string;
	enabled?: boolean;
	fallback?: string;
	fetchpriority?: "high" | "low" | "auto";
	height?: number | null;
	loading?: "eager" | "lazy";
	referrerPolicy?: JSX.ImgHTMLAttributes<HTMLImageElement>["referrerpolicy"];
	sizes?: string;
	source: ThumbnailSource | StaticThumbnailSource | null;
	width?: number | null;
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const [url, setUrl] = createSignal<string | null>(null);
	const [srcSet, setSrcSet] = createSignal<string | undefined>();
	const [error, setError] = createSignal(false);
	const [failedStaticSource, setFailedStaticSource] = createSignal<{
		source: StaticThumbnailSource;
		retry: boolean;
	}>();
	let previousSource: ThumbnailSource | undefined;
	let loadGeneration = 0;
	let image: HTMLImageElement | undefined;

	const staticSource = () => {
		const source = props.source;
		return source && "url" in source ? source : undefined;
	};
	const staticFailure = () => {
		const failure = failedStaticSource();
		return failure?.source === staticSource() ? failure : undefined;
	};
	const imageUrl = () => {
		const source = staticSource();
		if (!source) return error() || !props.source ? undefined : url();
		if (props.enabled === false) return;
		const failure = staticFailure();
		return failure
			? failure.retry
				? source.fallbackUrl
				: undefined
			: source.url;
	};
	const imageSrcSet = () => {
		const source = staticSource();
		return source ? (staticFailure() ? undefined : source.srcSet) : srcSet();
	};

	createTrackedEffect(() => {
		const source = props.source;
		if (!source || "url" in source) return;
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

		return () => {
			cancelled = true;
			unsubscribe?.();
		};
	});

	const handleLoad = () => {
		const source = props.source;
		if (source && !("url" in source)) source.onLoad?.();
	};

	const handleError = (element: HTMLImageElement) => {
		const source = props.source;
		if (!source) return;
		if ("url" in source) {
			const failedUrl = element.currentSrc || element.src;
			setFailedStaticSource({
				source,
				retry:
					!!source.fallbackUrl &&
					!staticFailure() &&
					failedUrl !== source.fallbackUrl,
			});
			return;
		}
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

	onSettled(() => {
		// An image in server-rendered HTML may have failed before hydration.
		if (staticSource() && image?.complete && !image.naturalWidth)
			handleError(image);
	});

	return (
		<Show
			fallback={
				<div class="flex h-full w-full items-center justify-center overflow-hidden bg-muted p-2 text-center text-muted-foreground text-xs break-words">
					<span class="line-clamp-3">{props.fallback ?? props.alt}</span>
				</div>
			}
			when={imageUrl()}
		>
			{(resolvedUrl) => (
				<img
					alt={props.alt}
					class={props.class}
					decoding="async"
					draggable="false"
					fetchpriority={props.fetchpriority}
					height={props.height ?? undefined}
					loading={props.loading}
					onDragStart={(event) => event.preventDefault()}
					onError={(event) => handleError(event.currentTarget)}
					onLoad={handleLoad}
					ref={(element) => {
						image = element;
					}}
					referrerpolicy={props.referrerPolicy}
					sizes={!staticSource() && srcSet() ? props.sizes : undefined}
					srcset={imageSrcSet()}
					src={resolvedUrl()}
					width={props.width ?? undefined}
				/>
			)}
		</Show>
	);
}

import { createTrackedEffect } from "solid-js";
