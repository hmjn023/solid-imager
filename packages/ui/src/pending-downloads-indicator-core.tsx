import { getErrorMessage } from "@solid-imager/core/utils";
import {
	type Accessor,
	createSignal,
	ErrorBoundary,
	type JSX,
	onCleanup,
	onMount,
} from "solid-js";
import type { PendingDownloadsIndicatorProps } from "./pending-downloads-indicator.types";
import { toast } from "./toast";

export type PendingDownloadsIndicatorCoreProps =
	PendingDownloadsIndicatorProps & {
		renderButton: (props: {
			onOpen: () => void;
			pendingCount: Accessor<number | undefined>;
		}) => JSX.Element;
		renderFallback: () => JSX.Element;
		renderModal: (props: {
			isOpen: boolean;
			onClose: () => void;
			onImportCompleted: () => void;
		}) => JSX.Element;
	};

export function PendingDownloadsIndicatorCore(
	props: PendingDownloadsIndicatorCoreProps,
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
		<ErrorBoundary fallback={props.renderFallback}>
			{props.renderButton({
				onOpen: () => setIsModalOpen(true),
				pendingCount,
			})}
			{props.renderModal({
				isOpen: isModalOpen(),
				onClose: () => setIsModalOpen(false),
				onImportCompleted: () => {
					void refreshPendingCount();
				},
			})}
		</ErrorBoundary>
	);
}
