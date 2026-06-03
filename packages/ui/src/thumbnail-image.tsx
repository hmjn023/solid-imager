import { createEffect, createSignal, onCleanup, Show } from "solid-js";

export interface ThumbnailSource {
	getUrl(): string | Promise<string>;
	onError?(): void;
	onLoad?(): void;
	subscribe?(callback: () => void): () => void;
}

export interface ThumbnailImageProps {
	alt: string;
	class?: string;
	fallback?: string;
	height?: number | null;
	loading?: "eager" | "lazy";
	source: ThumbnailSource;
	width?: number | null;
}

export function ThumbnailImage(props: ThumbnailImageProps) {
	const [url, setUrl] = createSignal<string | null>(null);
	const [error, setError] = createSignal(false);

	createEffect(() => {
		const source = props.source;
		setError(false);
		let cancelled = false;

		const load = async () => {
			try {
				const resolved = await source.getUrl();
				if (!cancelled) {
					setUrl(resolved);
				}
			} catch {
				if (!cancelled) {
					setError(true);
					source.onError?.();
				}
			}
		};

		void load();

		const unsubscribe = source.subscribe?.(() => {
			setError(false);
			void load();
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
					height={props.height ?? undefined}
					loading={props.loading}
					onError={handleError}
					onLoad={handleLoad}
					src={resolvedUrl()}
					width={props.width ?? undefined}
				/>
			)}
		</Show>
	);
}
