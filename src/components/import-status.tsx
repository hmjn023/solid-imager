import { createResource, createSignal, Show } from "solid-js";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import ImportPreviewModal from "./import-preview-modal";

/**
 * Component to display pending import status and trigger the preview modal.
 */
export default function ImportStatus() {
  const [selectedJobId, setSelectedJobId] = createSignal<string | null>(null);
  const [isModalOpen, setIsOpen] = createSignal(false);

  const [pendingJobs, { refetch }] = createResource(async () => {
    try {
      return await orpc.downloads.listPending();
    } catch (_e) {
      return [];
    }
  });

  const openPreview = (jobId: string) => {
    setSelectedJobId(jobId);
    setIsOpen(true);
  };

  return (
    <>
      <Show when={(pendingJobs()?.length || 0) > 0}>
        <div class="relative flex items-center">
          <button
            class="flex animate-pulse items-center gap-1 rounded bg-orange-500 px-2 py-1 font-bold text-white text-xs hover:bg-orange-600"
            onClick={() => {
              const jobs = pendingJobs();
              if (jobs && jobs.length > 0) {
                openPreview(jobs[0].id);
              }
            }}
            type="button"
          >
            <span>📥 {pendingJobs()?.length} Pending Import(s)</span>
          </button>
        </div>
      </Show>

      <Show when={selectedJobId()}>
        {(() => {
          const id = selectedJobId();
          return id ? (
            <ImportPreviewModal
              isOpen={isModalOpen()}
              jobId={id}
              onApproved={() => {
                refetch();
                setSelectedJobId(null);
              }}
              onClose={() => setIsOpen(false)}
            />
          ) : null;
        })()}
      </Show>
    </>
  );
}
