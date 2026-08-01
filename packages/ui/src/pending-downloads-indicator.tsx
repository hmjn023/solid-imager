import type { ImportEvent } from "@solid-imager/core/domain/sources/events";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	createSignal,
	ErrorBoundary,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import {
	ImportReviewModal,
	type PendingImportJob,
} from "./import-review-modal";
import { toast } from "./toast";

export type ImportEventHandler = (event: ImportEvent) => void | Promise<void>;
export type ImportEventConnectedHandler = () => void | Promise<void>;

export type PendingDownloadsIndicatorProps = {
	countPending: () => Promise<number>;
	listPending: () => Promise<PendingImportJob[]>;
	listSources: () => Promise<SafeMediaSource[]>;
	processPending: (
		jobIds: string[],
		targetSourceId: string,
	) => Promise<{ success: boolean; processedCount: number }>;
	cancelPending: (jobIds: string[]) => Promise<{ success: boolean }>;
	subscribeImportEvents: (
		handler: ImportEventHandler,
		onConnected?: ImportEventConnectedHandler,
	) => Promise<(() => void) | undefined> | (() => void) | undefined;
};

export function PendingDownloadsIndicator(
	props: PendingDownloadsIndicatorProps,
) {
	const [isModalOpen, setIsModalOpen] = createSignal(false);
	const [pendingCount, setPendingCount] = createSignal<number>();
	let eventVersion = 0;
	let refreshRequested = false;
	let refreshInFlight: Promise<void> | undefined;

	const refreshPendingCount = () => {
		refreshRequested = true;
		if (refreshInFlight) {
			return refreshInFlight;
		}

		refreshInFlight = (async () => {
			while (refreshRequested) {
				refreshRequested = false;
				const requestEventVersion = eventVersion;
				try {
					const count = await props.countPending();
					if (requestEventVersion === eventVersion) {
						setPendingCount(count);
					} else {
						refreshRequested = true;
					}
				} catch (error) {
					toast.error(`Failed to check inbox: ${getErrorMessage(error)}`);
				}
			}
		})().finally(() => {
			refreshInFlight = undefined;
		});

		return refreshInFlight;
	};

	const hasPendingImports = () => (pendingCount() ?? 0) > 0;

	onMount(() => {
		let disposed = false;
		let cleanup: (() => void) | undefined;

		void Promise.resolve(
			props.subscribeImportEvents(
				(event) => {
					eventVersion += 1;
					const currentCount = pendingCount();
					if (currentCount !== undefined) {
						switch (event.event) {
							case "import-request:created":
								setPendingCount(currentCount + event.data.count);
								break;
							case "import-request:processed":
								setPendingCount(
									Math.max(0, currentCount - event.data.processedCount),
								);
								break;
							case "import-request:deleted":
								setPendingCount(
									Math.max(0, currentCount - event.data.jobIds.length),
								);
								break;
							default: {
								const exhaustiveCheck: never = event;
								return exhaustiveCheck;
							}
						}
					}
					void refreshPendingCount();
				},
				() => refreshPendingCount(),
			),
		)
			.then((unsub) => {
				if (disposed) {
					unsub?.();
					return;
				}
				cleanup = unsub;
			})
			.catch(() => {
				if (!disposed) {
					toast.error("Connection to inbox lost");
				}
			});

		onCleanup(() => {
			disposed = true;
			cleanup?.();
		});
	});

	return (
		<ErrorBoundary
			fallback={() => (
				<button
					class="cursor-default rounded bg-gray-700 px-3 py-1.5 font-bold text-gray-400 text-xs"
					disabled
					type="button"
				>
					Inbox
				</button>
			)}
		>
			<button
				aria-disabled={!hasPendingImports()}
				class={`flex items-center gap-1 rounded px-3 py-1.5 font-bold text-xs transition-colors ${
					hasPendingImports()
						? "bg-sky-600 text-white hover:bg-sky-500"
						: "cursor-default bg-gray-700 text-gray-400"
				}`}
				onClick={() => {
					if (hasPendingImports()) {
						setIsModalOpen(true);
					}
				}}
				type="button"
			>
				<span>Inbox</span>
				<Show when={(pendingCount() ?? 0) > 0}>
					<span class="rounded bg-white px-1.5 py-0.5 text-sky-700">
						{pendingCount()}
					</span>
				</Show>
			</button>
			<ImportReviewModal
				cancelPending={props.cancelPending}
				isOpen={isModalOpen()}
				listPending={props.listPending}
				listSources={props.listSources}
				onClose={() => setIsModalOpen(false)}
				onImportCompleted={() => {
					void refreshPendingCount();
				}}
				processPending={props.processPending}
			/>
		</ErrorBoundary>
	);
}
