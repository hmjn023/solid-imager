import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import { toast } from "solid-toast";
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
import { Checkbox } from "~/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Character } from "~/domain/characters/schemas";
import type { Ip } from "~/domain/ips/schemas";
import type { Project } from "~/domain/projects/schemas";
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
    ipId?: string;
  }>({ name: "", description: "" });

  // Tagging State
  const [selectedSourceId, setSelectedSourceId] = createSignal<
    string | undefined
  >(undefined);
  const [forceRetag, setForceRetag] = createSignal(false);
  const [taggingStatus, setTaggingStatus] = createSignal<string | null>(null);

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
    const initialData: { name: string; description: string; ipId?: string } = {
      name: item.name,
      description: item.description || "",
    };

    if (activeTab() === "characters") {
      const char = item as Character;
      if (char.ipId) {
        initialData.ipId = char.ipId;
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
      const result = await orpc.ai.batchTagging({
        force: forceRetag(),
        mediaSourceId: selectedSourceId(),
      });
      if (result.success) {
        toast.success(result.message);
        setTaggingStatus("Batch tagging started successfully.");
      } else {
        toast.error("Failed to start batch tagging.");
        setTaggingStatus("Failed to start batch tagging.");
      }
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
      setTaggingStatus(`Error: ${(e as Error).message}`);
    }
  };

  return (
    <div class="container mx-auto p-8">
      <div class="mb-8 flex items-center justify-between">
        <h1 class="font-bold text-3xl">Entity Manager</h1>
        <Button onClick={openCreateDialog}>Create New</Button>
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
        <div class="max-w-xl space-y-6">
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
                  onChange={(val) => setSelectedSourceId(val?.id || "")}
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
                  id="force-retag"
                  onChange={setForceRetag}
                />
                <Label for="force-retag">Force Re-tagging</Label>
              </div>
              <p class="text-muted-foreground text-xs">
                If checked, existing AI tags will be ignored and images will be
                re-analyzed.
              </p>

              <div class="pt-2">
                <Button onClick={handleStartBatchTagging}>
                  Start Batch Tagging
                </Button>
              </div>

              <Show when={taggingStatus()}>
                <div class="mt-4 rounded bg-gray-100 p-2 text-sm">
                  {taggingStatus()}
                </div>
              </Show>
            </CardContent>
          </Card>
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
                      activeTab() === "characters" && (item as Character).ipId
                    }
                  >
                    <CardDescription>
                      IP:{" "}
                      {ips.data?.find(
                        (ip) => ip.id === (item as Character).ipId
                      )?.name || "Unknown"}
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
              {activeTab().slice(0, -1).toUpperCase()}
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
                <Label class="text-right">IP</Label>
                <div class="col-span-3">
                  <Select
                    itemComponent={(props) => (
                      <SelectItem item={props.item}>
                        {props.item.rawValue.name}
                      </SelectItem>
                    )}
                    onChange={(value) =>
                      setFormData({ ...formData(), ipId: value?.id || "" })
                    }
                    options={Array.isArray(ips.data) ? ips.data : []}
                    optionTextValue="name"
                    optionValue="id"
                    placeholder="Select an IP"
                    value={
                      formData().ipId
                        ? (Array.isArray(ips.data) ? ips.data : []).find(
                            (ip) => ip.id === formData().ipId
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
                            : "Select an IP";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
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
