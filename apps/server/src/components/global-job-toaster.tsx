import { Progress } from "@solid-imager/ui/progress";
import { Toaster, toast } from "@solid-imager/ui/toast";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";

const PERCENTAGE_MULTIPLIER = 100;

type JobProgressData = {
  jobId: string;
  processed: number;
  total: number;
};

const JobProgressToast = (props: { processed: number; total: number }) => (
  <div class="flex w-full min-w-[200px] flex-col gap-2">
    <div class="font-medium text-sm">Job in Progress</div>
    <div class="text-muted-foreground text-xs">
      Processed: {props.processed} / {props.total}
    </div>
    <Progress
      class="h-2"
      value={(props.processed / props.total) * PERCENTAGE_MULTIPLIER}
    />
  </div>
);

export function GlobalJobToaster() {
  const [mounted, setMounted] = createSignal(false);
  const [_activeJobs, setActiveJobs] = createSignal<
    Record<string, JobProgressData>
  >({});
  const [toastIds, setToastIds] = createSignal<Record<string, string>>({});

  const cleanupJob = (jobId: string) => {
    setToastIds((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    setActiveJobs((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  };

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

        setActiveJobs((prev) => ({ ...prev, [jobId]: data }));

        const currentToastId = toastIds()[jobId];
        const newToastId = toast.loading(
          () => <JobProgressToast processed={processed} total={total} />,
          {
            id: currentToastId,
            duration: Number.POSITIVE_INFINITY,
          }
        );

        if (!currentToastId && typeof newToastId === "string") {
          setToastIds((prev) => ({ ...prev, [jobId]: newToastId }));
        }
      } catch (_e) {
        // Ignore JSON parse errors
      }
    };

    const _onCompleted = (event: MessageEvent) => {
      try {
        const { jobId } = JSON.parse(event.data);
        const toastId = toastIds()[jobId];

        toast.success("Job completed successfully", { id: toastId });
        cleanupJob(jobId);
      } catch (_e) {
        // Ignore
      }
    };

    const onFailed = (event: MessageEvent) => {
      try {
        const { jobId, error } = JSON.parse(event.data);
        const toastId = toastIds()[jobId];

        toast.error(`Job failed: ${error}`, { id: toastId });
        cleanupJob(jobId);
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
