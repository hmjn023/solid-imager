import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { toast } from "solid-toast";
import { MediaCardItem } from "~/components/media/media-card-item";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Checkbox,
  CheckboxControl,
  CheckboxLabel,
} from "~/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxItemLabel,
  ComboboxTrigger,
} from "~/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  createCharacter,
  deleteCharacter,
  fetchAllCharacters,
  updateCharacter,
} from "~/infrastructure/api-clients/characters-api";
import {
  createIp,
  deleteIp,
  fetchAllIps,
  updateIp,
} from "~/infrastructure/api-clients/ips-api";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import {
  createProject,
  deleteProject,
  fetchAllProjects,
  updateProject,
} from "~/infrastructure/api-clients/projects-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

type EntityType = "projects" | "ips" | "characters" | "tagging";
type Entity = Project | Ip | Character;

export default function ManagerPage() {
  const [activeTab, setActiveTab] = createSignal<EntityType>("projects");
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
  const [editingItem, setEditingItem] = createSignal<Entity | null>(null);
  const [itemToDelete, setItemToDelete] = createSignal<Entity | null>(null);
  const [formData, setFormData] = createSignal<{
    name: string;
    description: string;
    ipIds?: string[];
  }>({ name: "", description: "" });

  // Tagging State
  const [selectedSourceId, setSelectedSourceId] = createSignal<
    string | undefined
  >(undefined);
  const [forceRetag, setForceRetag] = createSignal(false);
  const [taggingStatus, setTaggingStatus] = createSignal<string | null>(null);
  const [scannedMedia, setScannedMedia] = createSignal<Media[]>([]);
  const [selectedMedia, setSelectedMedia] = createSignal<Set<string>>(
    new Set()
  );
  const [jobProgress, setJobProgress] = createSignal<{
    processed: number;
    total: number;
  } | null>(null);
  const [activeJobId, setActiveJobId] = createSignal<string | null>(null);

  const queryClient = useQueryClient();

  const projects = createQuery(() => ({
    queryKey: ["allProjects"],
    queryFn: fetchAllProjects,
  }));
  const ips = createQuery(() => ({
    queryKey: ["allIps"],
    queryFn: fetchAllIps,
  }));
  const characters = createQuery(() => ({
    queryKey: ["allCharacters"],
    queryFn: fetchAllCharacters,
  }));
  const sources = createQuery(() => ({
    queryKey: ["allSources"],
    queryFn: fetchMediaSources,
  }));

  const invalidateQueries = () => {
    if (activeTab() === "projects") {
      queryClient.invalidateQueries({ queryKey: ["allProjects"] });
    } else if (activeTab() === "ips") {
      queryClient.invalidateQueries({ queryKey: ["allIps"] });
    } else if (activeTab() === "characters") {
      queryClient.invalidateQueries({ queryKey: ["allCharacters"] });
    }
  };

  const handleCreate = async () => {
    const data = formData();
    if (activeTab() === "projects") {
      await createProject(data);
    } else if (activeTab() === "ips") {
      await createIp(data);
    } else if (activeTab() === "characters") {
      await createCharacter(data);
    }
    invalidateQueries();
    setIsDialogOpen(false);
    setFormData({ name: "", description: "" });
  };

  const handleUpdate = async () => {
    const data = formData();
    const id = editingItem()?.id;
    if (!id) {
      return;
    }

    if (activeTab() === "projects") {
      await updateProject(id, data);
    } else if (activeTab() === "ips") {
      await updateIp(id, data);
    } else if (activeTab() === "characters") {
      await updateCharacter(id, data);
    }
    invalidateQueries();
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData({ name: "", description: "" });
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({ name: "", description: "" });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: Entity) => {
    setEditingItem(item);
    const initialData: { name: string; description: string; ipIds?: string[] } =
      {
        name: item.name,
        description: item.description || "",
      };

    if (activeTab() === "characters") {
      const char = item as Character;
      if (char.ips) {
        initialData.ipIds = char.ips.map((ip) => ip.id);
      }
    }

    setFormData(initialData);
    setIsDialogOpen(true);
  };

  const getActiveItems = () => {
    switch (activeTab()) {
      case "projects":
        return projects.data || [];
      case "ips":
        return ips.data || [];
      case "characters":
        return characters.data || [];
      default:
        return [];
    }
  };

  const handleConfirmDelete = async () => {
    const item = itemToDelete();
    if (!item) {
      return;
    }

    try {
      if (activeTab() === "projects") {
        await deleteProject(item.id);
      } else if (activeTab() === "ips") {
        await deleteIp(item.id);
      } else if (activeTab() === "characters") {
        await deleteCharacter(item.id);
      }
      invalidateQueries();
      toast.success("Deleted successfully");
    } catch (e) {
      toast.error(`Failed to delete: ${(e as Error).message}`);
    } finally {
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleStartBatchTagging = async () => {
    try {
      setTaggingStatus("Starting...");
      setJobProgress(null);
      const result = await orpc.ai.startBatchTaggingWithIds({
        force: forceRetag(),
        mediaSourceId: selectedSourceId(),
        mediaIds: Array.from(selectedMedia()),
      });
      if (result.success && result.jobId) {
        toast.success(result.message);
        setTaggingStatus("Batch tagging in progress...");
        setActiveJobId(result.jobId);
        setScannedMedia([]);
        setSelectedMedia(new Set<string>());
      } else {
        toast.error("Failed to start batch tagging.");
        setTaggingStatus("Failed to start batch tagging.");
      }
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
      setTaggingStatus(`Error: ${(e as Error).message}`);
    }
  };

  createEffect(() => {
    const jobId = activeJobId();
    if (!jobId) {
      return;
    }

    const eventSource = new EventSource("/api/events");

    const onProgress = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.jobId === jobId) {
          setJobProgress(data);
          setTaggingStatus(
            `Processing: ${data.processed} / ${data.total} tagged.`
          );
        }
      } catch (_e) {
        // ignore
      }
    };

    const onCompleted = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.jobId === jobId) {
          toast.success("Batch tagging completed!");
          setTaggingStatus("Batch tagging completed successfully.");
          setActiveJobId(null);
          setJobProgress(null);
          eventSource.close();
        }
      } catch (_e) {
        // ignore
      }
    };

    const onFailed = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.jobId === jobId) {
          toast.error(`Job failed: ${data.error}`);
          setTaggingStatus(`Job failed: ${data.error}`);
          setActiveJobId(null);
          setJobProgress(null);
          eventSource.close();
        }
      } catch (_e) {
        // ignore
      }
    };

    eventSource.addEventListener("job-progress", onProgress);
    eventSource.addEventListener("job-completed", onCompleted);
    eventSource.addEventListener("job-failed", onFailed);

    onCleanup(() => {
      eventSource.removeEventListener("job-progress", onProgress);
      eventSource.removeEventListener("job-completed", onCompleted);
      eventSource.removeEventListener("job-failed", onFailed);
      eventSource.close();
    });
  });

  const handleScan = async () => {
    try {
      setTaggingStatus("Scanning...");
      setScannedMedia([]);
      const result = await orpc.ai.scanBatchTaggingTargets({
        force: forceRetag(),
        mediaSourceId: selectedSourceId(),
      });
      setScannedMedia(result);
      setSelectedMedia(new Set(result.map((m) => m.id))); // Initially select all
      setTaggingStatus(`${result.length} items found.`);
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
      setTaggingStatus(`Error during scan: ${(e as Error).message}`);
    }
  };

  const toggleMediaSelection = (mediaId: string) => {
    setSelectedMedia((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedMedia().size === scannedMedia().length) {
      setSelectedMedia(new Set<string>());
    } else {
      setSelectedMedia(new Set(scannedMedia().map((m) => m.id)));
    }
  };

  return (
    <div class="container mx-auto p-8">
      <div class="mb-8 flex items-center justify-between">
        <h1 class="font-bold text-3xl">Entity Manager</h1>
        <Show when={activeTab() !== "tagging"}>
          <Button onClick={openCreateDialog}>Create New</Button>
        </Show>
      </div>

      <div class="mb-6 flex space-x-4 border-b">
        <button
          class={`border-b-2 px-4 py-2 font-medium transition-colors ${
            activeTab() === "projects"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("projects")}
          type="button"
        >
          Projects
        </button>
        <button
          class={`border-b-2 px-4 py-2 font-medium transition-colors ${
            activeTab() === "ips"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("ips")}
          type="button"
        >
          IPs
        </button>
        <button
          class={`border-b-2 px-4 py-2 font-medium transition-colors ${
            activeTab() === "characters"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("characters")}
          type="button"
        >
          Characters
        </button>
        <button
          class={`border-b-2 px-4 py-2 font-medium transition-colors ${
            activeTab() === "tagging"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("tagging")}
          type="button"
        >
          Batch Tagging
        </button>
      </div>

      <Show when={activeTab() === "tagging"}>
        <div class="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Batch AI Tagging</CardTitle>
              <CardDescription>
                Analyze and tag images across your media sources using AI.
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid gap-2">
                <Label>Target Media Source (Optional)</Label>
                <Select
                  itemComponent={(props) => (
                    <SelectItem item={props.item}>
                      {props.item.rawValue.name}
                    </SelectItem>
                  )}
                  onChange={(val) => setSelectedSourceId(val?.id)}
                  options={Array.isArray(sources.data) ? sources.data : []}
                  optionTextValue="name"
                  optionValue="id"
                  placeholder="All Sources"
                  value={
                    selectedSourceId()
                      ? (Array.isArray(sources.data) ? sources.data : []).find(
                          (s) => s.id === selectedSourceId()
                        )
                      : null
                  }
                >
                  <SelectTrigger>
                    <SelectValue<unknown>>
                      {(state) => {
                        const option = state.selectedOption();
                        return option &&
                          typeof option === "object" &&
                          "name" in option
                          ? (option as { name: string }).name
                          : "All Sources";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>
                <p class="text-muted-foreground text-xs">
                  Leave empty to process all sources.
                </p>
              </div>

              <div class="flex items-center space-x-2">
                <Checkbox
                  checked={forceRetag()}
                  class="flex items-center space-x-2"
                  id="force-retag"
                  onChange={setForceRetag}
                >
                  <CheckboxControl />
                  <CheckboxLabel>Force Re-tagging</CheckboxLabel>
                </Checkbox>
              </div>
              <p class="text-muted-foreground text-xs">
                If checked, existing AI tags will be ignored and images will be
                re-analyzed.
              </p>

              <div class="flex items-center gap-x-2 pt-2">
                <Button onClick={handleScan}>Scan for Targets</Button>
                <Button
                  disabled={scannedMedia().length === 0}
                  onClick={handleStartBatchTagging}
                >
                  Start Batch Tagging ({selectedMedia().size})
                </Button>
              </div>

              <Show when={taggingStatus()}>
                <div class="mt-4 rounded bg-gray-100 p-2 text-sm">
                  {taggingStatus()}
                </div>
              </Show>
              <Show when={jobProgress()}>
                {(progress) => (
                  <div class="mt-4">
                    <Progress
                      // biome-ignore lint/style/noMagicNumbers: Percentage calculation
                      value={(progress().processed / progress().total) * 100}
                    />
                  </div>
                )}
              </Show>
            </CardContent>
          </Card>
          <Show when={scannedMedia().length > 0}>
            <div class="mt-4">
              <div class="mb-2 flex items-center justify-between">
                <h3 class="font-bold text-lg">Scanned Media</h3>
                <Button onClick={toggleSelectAll} size="sm" variant="outline">
                  {selectedMedia().size === scannedMedia().length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>
              <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                <For each={scannedMedia()}>
                  {(media) => (
                    <MediaCardItem
                      media={media}
                      onToggle={(id) => toggleMediaSelection(id)}
                      selectable={true}
                      selected={selectedMedia().has(media.id)}
                    />
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={activeTab() !== "tagging"}>
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <For each={getActiveItems()}>
            {(item) => (
              <Card>
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                  <Show when={item.description}>
                    <CardDescription>{item.description}</CardDescription>
                  </Show>
                  <Show
                    when={
                      activeTab() === "characters" &&
                      (item as Character).ips &&
                      (item as Character).ips?.length > 0
                    }
                  >
                    <CardDescription>
                      IPs:{" "}
                      {(item as Character).ips.map((ip) => ip.name).join(", ")}
                    </CardDescription>
                  </Show>
                </CardHeader>
                <CardContent>
                  <div class="flex justify-end space-x-2">
                    <Button
                      onClick={() => openEditDialog(item)}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => {
                        setItemToDelete(item);
                        setIsDeleteDialogOpen(true);
                      }}
                      size="sm"
                      variant="destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </For>
        </div>
      </Show>

      <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem() ? "Edit" : "Create"}{" "}
              {activeTab() === "tagging"
                ? "TAGGING"
                : activeTab().slice(0, -1).toUpperCase()}
            </DialogTitle>
            <DialogDescription>
              {editingItem()
                ? "Update the details of the item."
                : "Enter the details for the new item."}
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div class="grid grid-cols-4 items-center gap-4">
              <Label class="text-right">Name</Label>
              <Input
                class="col-span-3"
                onInput={(e) =>
                  setFormData({ ...formData(), name: e.currentTarget.value })
                }
                value={formData().name}
              />
            </div>
            <div class="grid grid-cols-4 items-center gap-4">
              <Label class="text-right">Description</Label>
              <Input
                class="col-span-3"
                onInput={(e) =>
                  setFormData({
                    ...formData(),
                    description: e.currentTarget.value,
                  })
                }
                value={formData().description}
              />
            </div>
            <Show when={activeTab() === "characters"}>
              <div class="grid grid-cols-4 items-center gap-4">
                <Label class="text-right">IPs</Label>
                <div class="col-span-3">
                  <Combobox<Ip>
                    itemComponent={(props) => (
                      <ComboboxItem item={props.item}>
                        <ComboboxItemLabel>
                          {(props.item.rawValue as Ip).name}
                        </ComboboxItemLabel>
                        <ComboboxItemIndicator />
                      </ComboboxItem>
                    )}
                    multiple
                    onChange={(values) =>
                      setFormData({
                        ...formData(),
                        ipIds: values.map((v) => v.id),
                      })
                    }
                    optionLabel="name"
                    options={(ips.data || []) as Ip[]}
                    optionTextValue="name"
                    optionValue="id"
                    value={((ips.data || []) as Ip[]).filter((ip) =>
                      formData().ipIds?.includes(ip.id)
                    )}
                  >
                    <ComboboxControl>
                      <ComboboxInput placeholder="Select IPs..." />
                      <ComboboxTrigger />
                    </ComboboxControl>
                    <ComboboxContent />
                  </Combobox>
                </div>
              </div>
            </Show>
          </div>
          <DialogFooter>
            <Button onClick={editingItem() ? handleUpdate : handleCreate}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the{" "}
              {activeTab().slice(0, -1)} and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
