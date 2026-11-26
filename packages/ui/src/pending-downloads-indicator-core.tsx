import { t } from "@solid-imager/i18n";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	type Accessor,
	createContext,
	createEffect,
	createSignal,
	createUniqueId,
	Errored,
	onCleanup,
	onSettled,
	type ParentProps,
	type Setter,
	Show,
	useContext,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import type { PendingDownloadsIndicatorProps } from "./pending-downloads-indicator.types";
import { toast } from "./toast";
import { createSynchronousState } from "./utils/synchronous-state";

type PendingDownloadsSharedState = {
	pendingCount: Accessor<number | undefined>;
	setPendingCount: Setter<number | undefined>;
	isModalOpen: Accessor<boolean>;
	setIsModalOpen: (open: boolean) => void;
	ownerId: Accessor<string | null>;
	owns: (id: string) => boolean;
	registerOwner: (id: string) => { attach: () => void; detach: () => void };
};

const PendingDownloadsContext =
	createContext<PendingDownloadsSharedState | null>(null);

/**
 * Shares a single inbox count, event subscription, and review modal across
 * multiple indicator trigger locations (desktop sidebar, mobile header, drawer).
 */
export function PendingDownloadsProvider(props: ParentProps) {
	const [pendingCount, setPendingCount] = createSignal<number>();
	const [isModalOpen, setIsModalOpen] = createSignal(false);
	const owner = createSynchronousState<string | null>(null);

	const owners = new Map<string, { attached: boolean }>();
	const updateOwner = () => {
		const current = owner.current();
		if (current && owners.get(current)?.attached) return;
		for (const [id, candidate] of owners) {
			if (!candidate.attached) continue;
			owner.set(id);
			return;
		}
		owner.set(null);
	};
	const registerOwner = (id: string) => {
		const candidate = { attached: false };
		owners.set(id, candidate);
		return {
			attach: () => {
				candidate.attached = true;
				// Choose by trigger order after every attachment in this commit.
				queueMicrotask(updateOwner);
			},
			detach: () => {
				owners.delete(id);
				if (candidate.attached) queueMicrotask(updateOwner);
			},
		};
	};

	return (
		<PendingDownloadsContext
			value={{
				pendingCount,
				setPendingCount,
				isModalOpen,
				setIsModalOpen,
				ownerId: owner.read,
				owns: (id) => owner.current() === id && owners.has(id),
				registerOwner,
			}}
		>
			{props.children}
		</PendingDownloadsContext>
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

	let mounted = true;
	onCleanup(() => {
		mounted = false;
	});
	const isOwner = () => mounted && (!shared || shared.ownerId() === instanceId);
	const isCurrentOwner = () => mounted && (!shared || shared.owns(instanceId));

	if (shared) {
		const registration = shared.registerOwner(instanceId);
		onSettled(registration.attach);
		onCleanup(registration.detach);
	}

	let eventVersion = 0;
	let refreshRequested = false;
	let refreshInFlight: Promise<void> | undefined;

	const refreshPendingCount = async () => {
		if (!isCurrentOwner()) return;
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
					if (!isCurrentOwner()) return;
					if (requestEventVersion === eventVersion) {
						setPendingCount(count);
					} else {
						refreshRequested = true;
					}
				} catch (error) {
					if (!isCurrentOwner()) return;
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

	createEffect(
		() => (isOwner() ? props.subscribeImportEvents : undefined),
		(subscribe) => {
			if (!subscribe) return;

			let disposed = false;
			let cleanup: (() => void) | undefined;

			void Promise.resolve(
				subscribe(
					(event) => {
						if (disposed || !isCurrentOwner()) return;
						eventVersion += 1;
						setPendingCount((currentCount) => {
							if (currentCount === undefined) return undefined;
							switch (event.event) {
								case "import-request:created":
									return currentCount + event.data.count;
								case "import-request:processed":
									return Math.max(0, currentCount - event.data.processedCount);
								case "import-request:deleted":
									return Math.max(0, currentCount - event.data.jobIds.length);
								default: {
									const exhaustiveCheck: never = event;
									return exhaustiveCheck;
								}
							}
						});
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
						toast.error(
							t("pendingDownloadsIndicatorCore.connectionToInboxLost"),
						);
					}
				});

			return () => {
				disposed = true;
				cleanup?.();
			};
		},
	);

	return (
		<Errored fallback={props.renderFallback}>
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
		</Errored>
	);
}
