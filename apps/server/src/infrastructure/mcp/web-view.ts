import type {
	Media,
	MediaDetails,
} from "@solid-imager/core/domain/media/schemas";
import type { QueryUiState } from "@solid-imager/ui/query-state";
import {
	type Accessor,
	createEffect,
	createRoot,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";

type SearchView = {
	kind: "search";
	snapshotId: string | undefined;
	searchKey: string;
	resultsCurrent: boolean;
	ready: boolean;
	state: QueryUiState<Media[]>;
	media: Media[];
	total: number;
	selectedIds: string[];
};
type MediaView = { kind: "media"; media: MediaDetails };
export type WebView = SearchView | MediaView;

// Only mounted browser views register here; SSR never writes per-user state.
const [viewReader, setViewReader] = createSignal<Accessor<WebView>>();
export const readWebView = () => viewReader()?.();

export function useWebMcpView(read: Accessor<WebView>) {
	onMount(() => {
		setViewReader(() => read);
		onCleanup(() => {
			if (viewReader() === read) setViewReader(undefined);
		});
	});
}

/** Wait for the mounted view's actual data, rather than only the API response. */
export async function waitForWebView(
	accept: (view: WebView) => boolean,
	signal: AbortSignal,
) {
	signal.throwIfAborted();
	const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
	await new Promise<void>((resolve, reject) => {
		createRoot((dispose) => {
			const abort = () => {
				dispose();
				reject(boundedSignal.reason);
			};
			boundedSignal.addEventListener("abort", abort, { once: true });
			onCleanup(() => boundedSignal.removeEventListener("abort", abort));
			createEffect(() => {
				const view = readWebView();
				if (view && accept(view)) {
					dispose();
					resolve();
				}
			});
		});
	});
	await afterWebViewPaint(signal);
}

export function afterWebViewPaint(signal: AbortSignal) {
	signal.throwIfAborted();
	return new Promise<void>((resolve, reject) => {
		let frame = 0;
		const abort = () => {
			cancelAnimationFrame(frame);
			reject(signal.reason);
		};
		signal.addEventListener("abort", abort, { once: true });
		frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => {
				signal.removeEventListener("abort", abort);
				resolve();
			});
		});
	});
}
