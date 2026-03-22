import { toast } from "@solid-imager/ui/toast";
import {
	createResource,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { isServer } from "solid-js/web";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import ImportReviewModal from "./import-review-modal";

export default function PendingDownloadsIndicator() {
	const [isModalOpen, setIsModalOpen] = createSignal(false);

	const fetchPendingCount = async () => {
		if (isServer) {
			return 0;
		}
		try {
			const jobs = await orpc.imports.listPending();
			return jobs.length;
		} catch (_e) {
			if (!isServer) {
				toast.error("Failed to check inbox");
			}
			return 0;
		}
	};

	const [pendingCount, { refetch }] = createResource(fetchPendingCount);

	onMount(() => {
		if (isServer) {
			return;
		}

		const ac = new AbortController();
		const startEventStream = async () => {
			try {
				const stream = await orpc.imports.events(undefined, {
					signal: ac.signal,
				});

				for await (const msg of stream) {
					if (ac.signal.aborted) {
						break;
					}
					handleImportEvent(msg.event, refetch);
				}
			} catch (_err) {
				if (!ac.signal.aborted) {
					toast.error("Connection to inbox lost");
				}
			}
		};

		startEventStream();

		onCleanup(() => {
			ac.abort();
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
					<span class="rounded bg-white px-1.5 py-0.5 text-sky-700">
						{pendingCount()}
					</span>
				</Show>
			</button>

			<ImportReviewModal
				isOpen={isModalOpen()}
				onClose={() => setIsModalOpen(false)}
				onImportCompleted={() => {
					refetch();
				}}
			/>
		</>
	);
}

function handleImportEvent(event: string, refetch: () => void) {
	if (
		event === "import-request:created" ||
		event === "import-request:processed" ||
		event === "import-request:deleted"
	) {
		refetch();
	}
}
