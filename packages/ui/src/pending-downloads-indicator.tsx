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

export type ImportEventHandler = (event: ImportEvent) => void | Promise<void>;

export type PendingDownloadsIndicatorProps = {
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
					class="cursor-default rounded bg-gray-700 px-3 py-1.5 font-bold text-gray-400 text-xs"
					disabled
					type="button"
				>
					Inbox
				</button>
			)}
		>
			<button
				class={`flex items-center gap-1 rounded px-3 py-1.5 font-bold text-xs transition-colors ${
					(pendingCount() ?? 0) > 0
						? "bg-sky-600 text-white hover:bg-sky-500"
						: "cursor-default bg-gray-700 text-gray-400"
				}`}
				disabled={(pendingCount() ?? 0) === 0}
				onClick={() => setIsModalOpen(true)}
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
					void refetch();
				}}
				processPending={props.processPending}
			/>
		</ErrorBoundary>
	);
}
