import { createResource, createSignal, For, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import {
  createProject,
  deleteProject,
  fetchAllProjects,
  updateProject,
} from "~/infrastructure/api-clients/projects-api";

type EntityType = "projects" | "ips" | "characters";
type Entity = Project | Ip | Character;

export default function ManagerPage() {
  const [activeTab, setActiveTab] = createSignal<EntityType>("projects");
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [editingItem, setEditingItem] = createSignal<Entity | null>(null);
  const [formData, setFormData] = createSignal({ name: "", description: "" });

  const [projects, { refetch: refetchProjects }] =
    createResource(fetchAllProjects);
  const [ips, { refetch: refetchIps }] = createResource(fetchAllIps);
  const [characters, { refetch: refetchCharacters }] =
    createResource(fetchAllCharacters);

  const handleCreate = async () => {
    const data = formData();
    if (activeTab() === "projects") {
      await createProject(data);
      refetchProjects();
    } else if (activeTab() === "ips") {
      await createIp(data);
      refetchIps();
    } else if (activeTab() === "characters") {
      await createCharacter(data);
      refetchCharacters();
    }
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
      refetchProjects();
    } else if (activeTab() === "ips") {
      await updateIp(id, data);
      refetchIps();
    } else if (activeTab() === "characters") {
      await updateCharacter(id, data);
      refetchCharacters();
    }
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData({ name: "", description: "" });
  };

  const handleDelete = async (id: number) => {
    // biome-ignore lint/suspicious/noAlert: Simple confirmation
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }
    if (activeTab() === "projects") {
      await deleteProject(id);
      refetchProjects();
    } else if (activeTab() === "ips") {
      await deleteIp(id);
      refetchIps();
    } else if (activeTab() === "characters") {
      await deleteCharacter(id);
      refetchCharacters();
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({ name: "", description: "" });
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: Entity) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
    });
    setIsDialogOpen(true);
  };

  const getActiveItems = () => {
    switch (activeTab()) {
      case "projects":
        return projects() || [];
      case "ips":
        return ips() || [];
      case "characters":
        return characters() || [];
      default:
        return [];
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
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <For each={getActiveItems()}>
          {(item) => (
            <Card>
              <CardHeader>
                <CardTitle>{item.name}</CardTitle>
                <Show when={item.description}>
                  <CardDescription>{item.description}</CardDescription>
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
                    onClick={() => handleDelete(item.id)}
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
          </div>
          <DialogFooter>
            <Button onClick={editingItem() ? handleUpdate : handleCreate}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
