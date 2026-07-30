import type { ImportEvent } from "@solid-imager/core/domain/sources/events";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	createResource,
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

export type PendingDownloadsIndicatorProps = {
	compact?: boolean;
	variant?: "default" | "v2";
	listPending: () => Promise<PendingImportJob[]>;
	listSources: () => Promise<SafeMediaSource[]>;
	processPending: (
		jobIds: string[],
		targetSourceId: string,
	) => Promise<{ success: boolean; processedCount: number }>;
	cancelPending: (jobIds: string[]) => Promise<{ success: boolean }>;
	subscribeImportEvents: (
		handler: ImportEventHandler,
	) => Promise<(() => void) | undefined> | (() => void) | undefined;
};

export function PendingDownloadsIndicator(
	props: PendingDownloadsIndicatorProps,
) {
	const [isModalOpen, setIsModalOpen] = createSignal(false);
	const [pendingCount, { refetch }] = createResource(async () => {
		try {
			return (await props.listPending()).length;
		} catch (error) {
			toast.error(`Failed to check inbox: ${getErrorMessage(error)}`);
			return 0;
		}
	});

	onMount(() => {
		let disposed = false;
		let cleanup: (() => void) | undefined;

		void Promise.resolve(
			props.subscribeImportEvents(() => {
				void refetch();
			}),
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
			<button
				aria-label={`Import inbox${(pendingCount() ?? 0) > 0 ? `, ${pendingCount()}件` : ""}`}
				class={cn(
					"flex items-center gap-2 rounded-md px-3 font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					props.variant === "v2"
						? "h-10 w-full justify-start text-[var(--v2-text-secondary)] hover:bg-[var(--v2-surface-muted)] disabled:pointer-events-auto disabled:opacity-60"
						: (pendingCount() ?? 0) > 0
							? "bg-sky-600 py-1.5 text-white hover:bg-sky-500"
							: "cursor-default bg-gray-700 py-1.5 text-gray-400",
					props.compact && "size-10 justify-center px-0",
				)}
				disabled={(pendingCount() ?? 0) === 0}
				onClick={() => setIsModalOpen(true)}
				type="button"
			>
				<span aria-hidden="true" class="text-base leading-none">
					↓
				</span>
				<span class={props.compact ? "sr-only" : undefined}>Import inbox</span>
				<Show when={(pendingCount() ?? 0) > 0}>
					<span
						class={cn(
							"rounded-full px-1.5 py-0.5 text-[10px]",
							props.variant === "v2"
								? "ml-auto bg-[var(--v2-surface-selected)] text-[var(--v2-primary)]"
								: "bg-white text-sky-700",
							props.compact && "absolute -mt-5 ml-5",
						)}
					>
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
					void refetch();
				}}
				processPending={props.processPending}
				variant={props.variant}
			/>
		</ErrorBoundary>
	);
}
