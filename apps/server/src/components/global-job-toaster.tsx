import { Progress } from "@solid-imager/ui/progress";
import { createSignal, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";

const PERCENTAGE_MULTIPLIER = 100;

type JobProgressData = {
  jobId: string;
  processed: number;
  total: number;
};

import { Toaster, toast } from "@solid-imager/ui/toast";
import { onMount, Show } from "solid-js";

export function GlobalJobToaster() {
  const [mounted, setMounted] = createSignal(false);

  const [activeJobs, setActiveJobs] = createSignal<
    Record<string, JobProgressData>
  >({});
  const [toastIds, setToastIds] = createSignal<Record<string, string>>({});

  onMount(() => {
    if (isServer) {
      return;
    }
    setMounted(true);

    const eventSource = new EventSource("/api/events?channels=global-jobs");

    const onProgress = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as JobProgressData;
        const { jobId, processed, total } = data;

        setActiveJobs((prev) => ({
          ...prev,
          [jobId]: data,
        }));

        const currentToastIds = toastIds();
        let toastId = currentToastIds[jobId];

        if (toastId) {
          // Update the existing toast
          toast.loading(
            () => (
              <div class="flex w-full min-w-[200px] flex-col gap-2">
                <div class="font-medium text-sm">Job in Progress</div>
                <div class="text-muted-foreground text-xs">
                  Processed: {activeJobs()[jobId]?.processed || processed} /{" "}
                  {activeJobs()[jobId]?.total || total}
                </div>
                <Progress
                  class="h-2"
                  value={
                    ((activeJobs()[jobId]?.processed || processed) /
                      (activeJobs()[jobId]?.total || total)) *
                    PERCENTAGE_MULTIPLIER
                  }
                />
              </div>
            ),
            {
              id: toastId,
              duration: Number.POSITIVE_INFINITY,
            }
          );
        } else {
          // Create a new toast with a known ID
          toastId = toast.loading(
            () => (
              <div class="flex w-full min-w-[200px] flex-col gap-2">
                <div class="font-medium text-sm">Job in Progress</div>
                <div class="text-muted-foreground text-xs">
                  Processed: {activeJobs()[jobId]?.processed || processed} /{" "}
                  {activeJobs()[jobId]?.total || total}
                </div>
                <Progress
                  class="h-2"
                  value={
                    ((activeJobs()[jobId]?.processed || processed) /
                      (activeJobs()[jobId]?.total || total)) *
                    PERCENTAGE_MULTIPLIER
                  }
                />
              </div>
            ),
            {
              duration: Number.POSITIVE_INFINITY, // Keep it open until completed or failed
            }
          );

          if (typeof toastId === "string") {
            setToastIds((prev) => ({
              ...prev,
              [jobId]: toastId as string,
            }));
          }
        }
      } catch (_e) {
        // Ignore JSON parse errors
      }
    };

    const _onCompleted = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { jobId } = data;

        const currentToastIds = toastIds();
        const toastId = currentToastIds[jobId];

        if (toastId) {
          toast.success("Job completed successfully", { id: toastId });
          setToastIds((prev) => {
            const next = { ...prev };
            delete next[jobId];
            return next;
          });
        } else {
          toast.success("Job completed successfully");
        }

        setActiveJobs((prev) => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      } catch (_e) {
        // Ignore
      }
    };

    const onFailed = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { jobId, error } = data;

        const currentToastIds = toastIds();
        const toastId = currentToastIds[jobId];

        if (toastId) {
          toast.error(`Job failed: ${error}`, { id: toastId });
          setToastIds((prev) => {
            const next = { ...prev };
            delete next[jobId];
            return next;
          });
        } else {
          toast.error(`Job failed: ${error}`);
        }

        setActiveJobs((prev) => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      } catch (_e) {
        // Ignore
      }
    };

    eventSource.addEventListener("job-progress", onProgress);
    eventSource.addEventListener("job-completed", _onCompleted);
    eventSource.addEventListener("job-failed", onFailed);

    onCleanup(() => {
      eventSource.removeEventListener("job-progress", onProgress);
      eventSource.removeEventListener("job-completed", _onCompleted);
      eventSource.removeEventListener("job-failed", onFailed);
      eventSource.close();
    });
  });

  return (
    <Show when={mounted()}>
      <Toaster />
    </Show>
  );
}
