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

const POLL_INTERVAL = 10_000;

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
      return 0;
    }
  };

  const [pendingCount, { refetch }] = createResource(fetchPendingCount);

  // Poll every 10 seconds? or 30s?
  // Since we don't have socket, polling is easiest.
  let interval: ReturnType<typeof setInterval>;
  onMount(() => {
    interval = setInterval(() => refetch(), POLL_INTERVAL);
  });

  onCleanup(() => {
    clearInterval(interval);
  });

  return (
    <>
      <Show when={(pendingCount() ?? 0) > 0}>
        <button
          class="flex items-center gap-1 rounded bg-sky-600 px-3 py-1.5 font-bold text-white text-xs transition-colors hover:bg-sky-500"
          onClick={() => setIsModalOpen(true)}
          type="button"
        >
          <span>Inbox</span>
          <span class="rounded bg-white px-1.5 py-0.5 text-sky-700">
            {pendingCount()}
          </span>
        </button>
      </Show>

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
