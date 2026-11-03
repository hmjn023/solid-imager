import type { JobDto } from "@solid-imager/core/domain/jobs/schemas";
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
type JobsView = {
	kind: "jobs";
	job: Pick<JobDto, "id" | "type" | "status"> | undefined;
	failed: boolean;
};
export type WorkspaceView = SearchView | MediaView | JobsView;

// Only mounted browser views register here; SSR never writes per-user state.
const [viewReader, setViewReader] = createSignal<Accessor<WorkspaceView>>();
export const readWorkspaceView = () => viewReader()?.();

export function useWorkspaceView(read: Accessor<WorkspaceView>) {
	onMount(() => {
		setViewReader(() => read);
		onCleanup(() => {
			if (viewReader() === read) setViewReader(undefined);
		});
	});
}

/** Wait for the mounted view's actual data, rather than only the API response. */
export async function waitForWorkspaceView(
	accept: (view: WorkspaceView) => boolean,
	signal: AbortSignal,
	checkTarget: () => void,
) {
	signal.throwIfAborted();
	const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
	const ready = () => {
		checkTarget();
		const view = readWorkspaceView();
		return view && accept(view);
	};
	do {
		boundedSignal.throwIfAborted();
		await new Promise<void>((resolve, reject) => {
			createRoot((dispose) => {
				const abort = () => {
					dispose();
					reject(boundedSignal.reason);
				};
				boundedSignal.addEventListener("abort", abort, { once: true });
				onCleanup(() => boundedSignal.removeEventListener("abort", abort));
				createEffect(() => {
					try {
						if (ready()) {
							dispose();
							resolve();
						}
					} catch (error) {
						dispose();
						reject(error);
					}
				});
			});
		});
		await afterWebViewPaint(boundedSignal);
	} while (!ready());
}

export function afterWebViewPaint(signal: AbortSignal) {
	signal.throwIfAborted();
	return new Promise<void>((resolve, reject) => {
		let frame = 0;
		// Background tabs may never deliver animation frames. State updates have
		// already finished, so allow completion without a paint in that case.
		const fallback = setTimeout(finish, 100);
		function cleanup() {
			clearTimeout(fallback);
			cancelAnimationFrame(frame);
			signal.removeEventListener("abort", abort);
		}
		function finish() {
			cleanup();
			resolve();
		}
		const abort = () => {
			cleanup();
			reject(signal.reason);
		};
		signal.addEventListener("abort", abort, { once: true });
		frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(finish);
		});
	});
}
