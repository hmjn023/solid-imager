import { toast } from "@solid-imager/ui/toast";
import { listen } from "@tauri-apps/api/event";
import { createResource, createSignal, onCleanup, onMount, Show } from "solid-js";
import { listPendingImports } from "~/infrastructure/api-clients/imports-api";
import { ImportReviewModal } from "./import-review-modal";

export function PendingDownloadsIndicator() {
	const [isModalOpen, setIsModalOpen] = createSignal(false);
	const [pendingCount, { refetch }] = createResource(async () => {
		try {
			return (await listPendingImports()).length;
		} catch (error) {
			toast.error(`Failed to check inbox: ${(error as Error).message}`);
			return 0;
		}
	});

	onMount(() => {
		const unlistenPromises = [
			listen("import-request:created", () => void refetch()),
			listen("import-request:processed", () => void refetch()),
			listen("import-request:deleted", () => void refetch()),
		];
		onCleanup(() => {
			void Promise.all(unlistenPromises).then((callbacks) => {
				for (const callback of callbacks) {
					callback();
				}
			});
		});
	});

	return (
		<>
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
					<span class="rounded bg-white px-1.5 py-0.5 text-sky-700">{pendingCount()}</span>
				</Show>
			</button>
			<ImportReviewModal
				isOpen={isModalOpen()}
				onClose={() => setIsModalOpen(false)}
				onImportCompleted={() => {
					void refetch();
				}}
			/>
		</>
	);
}
