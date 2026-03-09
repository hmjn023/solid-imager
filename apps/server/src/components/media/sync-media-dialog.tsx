import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { Button } from "@solid-imager/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@solid-imager/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@solid-imager/ui/select";
import { createQuery } from "@tanstack/solid-query";
import { createSignal, Show } from "solid-js";
import { orpc as localOrpc } from "~/infrastructure/api-clients/orpc-client";

type SyncMediaDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (targetServerId: string, targetSourceId: string) => void;
};

export function SyncMediaDialog(props: SyncMediaDialogProps) {
  const [targetServerId, setTargetServerId] = createSignal<string | null>(null);
  const [targetSourceId, setTargetSourceId] = createSignal<string | null>(null);

  // Fetch local configuration
  const configQuery = createQuery(() => ({
    queryKey: ["config"],
    queryFn: async () => await localOrpc.config.get(),
    enabled: props.open,
  }));

  const servers = () => configQuery.data?.sync?.servers ?? [];

  // Query remote sources using TanStack Query via local backend proxy
  const remoteSourcesQuery = createQuery(() => ({
    queryKey: ["remote-sources", targetServerId()],
    queryFn: async () => {
      const serverId = targetServerId();
      if (!serverId) {
        return [];
      }

      const response = await localOrpc.media.getRemoteSources({
        targetServerId: serverId,
      });
      return response as SafeMediaSource[];
    },
    enabled: !!targetServerId() && props.open,
  }));

  const handleConfirm = () => {
    const server = targetServerId();
    const source = targetSourceId();
    if (server && source) {
      props.onConfirm(server, source);
      props.onOpenChange(false);
      setTargetServerId(null);
      setTargetSourceId(null);
    }
  };

  const serverOptions = () =>
    servers().map((s) => ({ value: s.id, label: s.name }));

  const sourceOptions = () =>
    remoteSourcesQuery.data?.map((s) => ({ value: s.id, label: s.name })) ?? [];

  return (
    <Dialog onOpenChange={props.onOpenChange} open={props.open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync Media</DialogTitle>
          <DialogDescription>
            Select the destination remote server and media source to sync this
            item to.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <Show when={configQuery.isLoading}>
            <p class="text-muted-foreground text-sm">Loading config...</p>
          </Show>
          <Show when={configQuery.isError}>
            <p class="text-red-500 text-sm">Failed to load config.</p>
          </Show>
          <Show when={configQuery.data}>
            <div class="space-y-2">
              <div class="font-medium text-sm">Remote Server</div>
              <Select
                itemComponent={(itemProps) => (
                  <SelectItem item={itemProps.item}>
                    {(itemProps.item.rawValue as { label: string }).label}
                  </SelectItem>
                )}
                onChange={(val) => {
                  setTargetServerId(val?.value ?? null);
                  setTargetSourceId(null);
                }}
                options={serverOptions()}
                optionTextValue="label"
                optionValue="value"
                value={
                  serverOptions().find((o) => o.value === targetServerId()) ??
                  null
                }
              >
                <SelectTrigger>
                  <SelectValue<{ label: string; value: string }>>
                    {(state) =>
                      state.selectedOption()?.label ?? "Select a server"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>
          </Show>

          <Show when={targetServerId()}>
            <div class="space-y-2">
              <div class="font-medium text-sm">Target Media Source</div>
              <Show when={remoteSourcesQuery.isLoading}>
                <p class="text-muted-foreground text-sm">
                  Loading remote sources...
                </p>
              </Show>
              <Show when={remoteSourcesQuery.isError}>
                <p class="text-red-500 text-sm">
                  {remoteSourcesQuery.error?.message ||
                    "Failed to load remote sources"}
                </p>
              </Show>
              <Show
                when={
                  !(remoteSourcesQuery.isLoading || remoteSourcesQuery.isError)
                }
              >
                <Select
                  itemComponent={(itemProps) => (
                    <SelectItem item={itemProps.item}>
                      {(itemProps.item.rawValue as { label: string }).label}
                    </SelectItem>
                  )}
                  onChange={(val) => setTargetSourceId(val?.value ?? null)}
                  options={sourceOptions()}
                  optionTextValue="label"
                  optionValue="value"
                  value={
                    sourceOptions().find((o) => o.value === targetSourceId()) ??
                    null
                  }
                >
                  <SelectTrigger>
                    <SelectValue<{ label: string; value: string }>>
                      {(state) =>
                        state.selectedOption()?.label ?? "Select a source"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              </Show>
            </div>
          </Show>
        </div>

        <DialogFooter>
          <Button onClick={() => props.onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={!(targetServerId() && targetSourceId())}
            onClick={handleConfirm}
          >
            Sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
