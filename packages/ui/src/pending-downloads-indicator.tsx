import type { ImportEvent } from "@solid-imager/core/domain/sources/events";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	type Accessor,
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
import { cn } from "./utils/cn";

export type ImportEventHandler = (event: ImportEvent) => void | Promise<void>;
export type ImportEventConnectedHandler = () => void | Promise<void>;

export type PendingDownloadsIndicatorProps = {
	compact?: boolean;
	variant?: "default" | "v2";
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

function LegacyPendingDownloadsButton(props: {
	onOpen: () => void;
	pendingCount: Accessor<number | undefined>;
}) {
	const hasPendingImports = () => (props.pendingCount() ?? 0) > 0;

	return (
		<button
			aria-disabled={!hasPendingImports()}
			class={`flex items-center gap-1 rounded px-3 py-1.5 font-bold text-xs transition-colors ${
				hasPendingImports()
					? "bg-sky-600 text-white hover:bg-sky-500"
					: "cursor-default bg-gray-700 text-gray-400"
			}`}
			onClick={() => {
				if (hasPendingImports()) {
					props.onOpen();
				}
			}}
			type="button"
		>
			<span>Inbox</span>
			<Show when={hasPendingImports()}>
				<span class="rounded bg-white px-1.5 py-0.5 text-sky-700">
					{props.pendingCount()}
				</span>
			</Show>
		</button>
	);
}

function V2PendingDownloadsButton(props: {
	compact?: boolean;
	onOpen: () => void;
	pendingCount: Accessor<number | undefined>;
}) {
	const hasPendingImports = () => (props.pendingCount() ?? 0) > 0;

	return (
		<button
			aria-disabled={!hasPendingImports()}
			aria-label={`Import inbox${hasPendingImports() ? `, ${props.pendingCount()}件` : ""}`}
			class={cn(
				"relative flex h-10 w-full items-center justify-start gap-2 rounded-md px-3 font-medium text-[var(--v2-text-secondary)] text-xs transition-colors hover:bg-[var(--v2-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-auto disabled:opacity-60",
				props.compact && "size-10 justify-center px-0",
			)}
			disabled={!hasPendingImports()}
			onClick={props.onOpen}
			type="button"
		>
			<span aria-hidden="true" class="text-base leading-none">
				↓
			</span>
			<span class={props.compact ? "sr-only" : undefined}>Import inbox</span>
			<Show when={hasPendingImports()}>
				<span
					class={cn(
						"ml-auto rounded-full bg-[var(--v2-surface-selected)] px-1.5 py-0.5 text-[10px] text-[var(--v2-primary)]",
						props.compact && "absolute -mt-5 ml-5",
					)}
				>
					{props.pendingCount()}
				</span>
			</Show>
		</button>
	);
}

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
					class={cn(
						"cursor-default rounded px-3 py-1.5 font-bold text-xs",
						props.variant === "v2"
							? "h-10 w-full bg-transparent text-[var(--v2-text-muted)]"
							: "bg-gray-700 text-gray-400",
					)}
					disabled
					type="button"
				>
					Inbox
				</button>
			)}
		>
			<Show
				fallback={
					<LegacyPendingDownloadsButton
						onOpen={() => setIsModalOpen(true)}
						pendingCount={pendingCount}
					/>
				}
				when={props.variant === "v2"}
			>
				<V2PendingDownloadsButton
					compact={props.compact}
					onOpen={() => setIsModalOpen(true)}
					pendingCount={pendingCount}
				/>
			</Show>
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
				variant={props.variant}
			/>
		</ErrorBoundary>
	);
}
