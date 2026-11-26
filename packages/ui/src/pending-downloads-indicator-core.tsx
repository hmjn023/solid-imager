import { t } from "@solid-imager/i18n";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	createUniqueId,
	ErrorBoundary,
	type JSX,
	onCleanup,
	type ParentProps,
	Show,
	useContext,
} from "solid-js";
import type { PendingDownloadsIndicatorProps } from "./pending-downloads-indicator.types";
import { toast } from "./toast";

type PendingDownloadsSharedState = {
	pendingCount: Accessor<number | undefined>;
	setPendingCount: (count: number | undefined) => void;
	isModalOpen: Accessor<boolean>;
	setIsModalOpen: (open: boolean) => void;
	ownerId: Accessor<string | null>;
	claimOwner: (id: string) => void;
	releaseOwner: (id: string) => void;
};

const PendingDownloadsContext = createContext<PendingDownloadsSharedState>();

/**
 * Shares a single inbox count, event subscription, and review modal across
 * multiple indicator trigger locations (desktop sidebar, mobile header, drawer).
 */
export function PendingDownloadsProvider(props: ParentProps) {
	const [pendingCount, setPendingCount] = createSignal<number>();
	const [isModalOpen, setIsModalOpen] = createSignal(false);
	const [ownerId, setOwnerId] = createSignal<string | null>(null);

	const claimOwner = (id: string) => {
		setOwnerId((current) => current ?? id);
	};
	const releaseOwner = (id: string) => {
		setOwnerId((current) => (current === id ? null : current));
	};

	return (
		<PendingDownloadsContext.Provider
			value={{
				pendingCount,
				setPendingCount,
				isModalOpen,
				setIsModalOpen,
				ownerId,
				claimOwner,
				releaseOwner,
			}}
		>
			{props.children}
		</PendingDownloadsContext.Provider>
	);
}

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
	const shared = useContext(PendingDownloadsContext);
	const instanceId = createUniqueId();
	const [localModalOpen, setLocalModalOpen] = createSignal(false);
	const [localPendingCount, setLocalPendingCount] = createSignal<number>();

	const pendingCount = shared ? shared.pendingCount : localPendingCount;
	const setPendingCount = shared
		? shared.setPendingCount
		: setLocalPendingCount;
	const isModalOpen = shared ? shared.isModalOpen : localModalOpen;
	const setIsModalOpen = shared ? shared.setIsModalOpen : setLocalModalOpen;

	const isOwner = () => !shared || shared.ownerId() === instanceId;

	if (shared) {
		createEffect(() => {
			if (shared.ownerId() === null) {
				shared.claimOwner(instanceId);
			}
		});
		onCleanup(() => {
			shared.releaseOwner(instanceId);
		});
	}

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
					toast.error(
						t("pendingDownloadsIndicatorCore.failedToCheckInboxValue", {
							value0: String(getErrorMessage(error)),
						}),
					);
				}
			}
		})().finally(() => {
			refreshInFlight = undefined;
		});

		return refreshInFlight;
	};

	createEffect(() => {
		if (!isOwner()) return;

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
					toast.error(t("pendingDownloadsIndicatorCore.connectionToInboxLost"));
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
			<Show when={isOwner()}>
				{props.renderModal({
					isOpen: isModalOpen(),
					onClose: () => setIsModalOpen(false),
					onImportCompleted: () => {
						void refreshPendingCount();
					},
				})}
			</Show>
		</ErrorBoundary>
	);
}
