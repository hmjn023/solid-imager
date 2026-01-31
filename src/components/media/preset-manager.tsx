import { createEffect, createResource, createSignal, Show } from "solid-js";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { Preset } from "~/domain/media/schemas";
import { loadPreset, searchState } from "~/domain/search/store";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
import { cn } from "~/presentation/utils/cn";

export function PresetManager(props: { class?: string }) {
  const [data, { refetch }] = createResource(PresetClient.list);

  // existing "current" preset should be hidden from UI
  const presets = () => data()?.filter((p) => p.name !== "current");

  const [isSaveDialogOpen, setIsSaveDialogOpen] = createSignal(false);

  // For Delete Confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
  const [presetToDelete, setPresetToDelete] = createSignal<number | null>(null);

  const [newPresetName, setNewPresetName] = createSignal("");
  const [selectedPresetId, setSelectedPresetId] = createSignal<string | null>(
    null
  );

  // Sync activePresetId from store to local selection
  createEffect(() => {
    const active = searchState.activePresetId;
    if (active) {
      setSelectedPresetId(String(active));
    } else {
      setSelectedPresetId(null);
    }
  });

  const handleSave = async () => {
    if (!newPresetName()) {
      return;
    }

    // Use current search state to build the preset value
    const { getSearchCondition } = await import("~/domain/search/store");
    const condition = getSearchCondition();

    if (!condition) {
      return;
    }

    try {
      await PresetClient.create({
        name: newPresetName(),
        value: condition,
      });
      setIsSaveDialogOpen(false);
      setNewPresetName("");
      refetch();
    } catch (_e) {
      // Ignore error
    }
  };

  const confirmDelete = (id: number) => {
    setPresetToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    const id = presetToDelete();
    if (!id) {
      return;
    }

    try {
      await PresetClient.delete(id);

      // If deleted preset was selected, clear selection
      if (selectedPresetId() === String(id)) {
        setSelectedPresetId(null);
      }

      refetch();
    } catch (_e) {
      // Ignore error
    } finally {
      setIsDeleteDialogOpen(false);
      setPresetToDelete(null);
    }
  };

  const handleLoad = () => {
    const id = selectedPresetId();
    if (!id) {
      return;
    }
    const preset = presets()?.find((p: Preset) => p.id === Number(id));
    if (preset) {
      loadPreset(preset);
    }
  };

  const handleClearSelection = () => {
    setSelectedPresetId(null);
  };

  return (
    <div class={cn("flex flex-col gap-2", props.class)}>
      {/* Delete Confirmation Dialog */}
      <AlertDialog
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>プリセットの削除</AlertDialogTitle>
            <AlertDialogDescription>
              本当にこのプリセットを削除しますか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              class="bg-red-500 hover:bg-red-600"
              onClick={executeDelete}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div class="flex items-center gap-2">
        <div class="min-w-0 flex-1">
          <Select
            itemComponent={(itemProps) => {
              const preset = presets()?.find(
                (p: Preset) =>
                  String(p.id) ===
                  (itemProps.item as { rawValue: string }).rawValue
              );
              return (
                <SelectItem
                  class="flex w-full justify-between gap-2"
                  item={itemProps.item}
                >
                  <span>{preset?.name}</span>
                </SelectItem>
              );
            }}
            onChange={setSelectedPresetId}
            options={presets()?.map((p: Preset) => String(p.id)) || []}
            placeholder="プリセットを選択..."
            value={selectedPresetId()}
          >
            <SelectTrigger class="w-full">
              <SelectValue<string>>
                {(state) => {
                  const preset = presets()?.find(
                    (p: Preset) =>
                      String(p.id) === (state.selectedOption() as string)
                  );
                  return (
                    <span class="truncate">
                      {preset ? preset.name : "プリセットを選択..."}
                    </span>
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </div>

        {/* Clear Selection Button */}
        <Show when={selectedPresetId()}>
          <Button
            class="h-10 w-10 shrink-0"
            onClick={handleClearSelection}
            size="icon"
            title="選択解除"
            variant="ghost"
          >
            <span class="i-lucide-x h-4 w-4" />
          </Button>
        </Show>
      </div>

      <div class="flex w-full items-center gap-2">
        <Button
          class="flex-1"
          disabled={!selectedPresetId()}
          onClick={handleLoad}
          variant="outline"
        >
          読込
        </Button>

        <Dialog onOpenChange={setIsSaveDialogOpen} open={isSaveDialogOpen()}>
          <DialogTrigger as={Button} class="flex-1" variant="secondary">
            保存
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>現在の検索条件を保存</DialogTitle>
              <DialogDescription>
                現在の検索条件に名前を付けて保存します。
              </DialogDescription>
            </DialogHeader>
            <div class="grid gap-4 py-4">
              <div class="grid grid-cols-4 items-center gap-4">
                <Label class="text-right">名前</Label>
                <Input
                  class="col-span-3"
                  onInput={(e) => setNewPresetName(e.currentTarget.value)}
                  value={newPresetName()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave}>保存する</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Button (Only shows when selected) */}
        <Show when={selectedPresetId()}>
          <Button
            class="text-red-500 hover:bg-red-100/50 hover:text-red-600"
            onClick={() => confirmDelete(Number(selectedPresetId()))}
            size="icon"
            title="プリセット削除"
            variant="ghost"
          >
            <span class="i-lucide-trash-2 h-4 w-4" />
          </Button>
        </Show>
      </div>
    </div>
  );
}
