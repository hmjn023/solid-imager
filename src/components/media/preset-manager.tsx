import { createResource, createSignal, Show } from "solid-js";
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
import { loadPreset } from "~/domain/search/store";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";
import { cn } from "~/presentation/utils/cn";

export function PresetManager(props: { class?: string }) {
  const [data, { refetch }] = createResource(PresetClient.list);

  // existing "current" preset should be hidden from UI
  const presets = () => data()?.filter((p) => p.name !== "current");

  const [isSaveDialogOpen, setIsSaveDialogOpen] = createSignal(false);
  const [newPresetName, setNewPresetName] = createSignal("");
  const [selectedPresetId, setSelectedPresetId] = createSignal<string | null>(
    null
  );

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

  const handleDelete = async (id: number) => {
    // biome-ignore lint/suspicious/noAlert: simple confirmation is sufficient here
    if (!window.confirm("本当に削除しますか？")) {
      return;
    }
    try {
      await PresetClient.delete(id);
      refetch();
    } catch (_e) {
      // Ignore error
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

  return (
    <div class={cn("flex flex-col gap-2", props.class)}>
      <Select
        itemComponent={(itemProps) => {
          const preset = presets()?.find(
            (p: Preset) =>
              String(p.id) === (itemProps.item as { rawValue: string }).rawValue
          );
          return (
            <SelectItem item={itemProps.item}>
              <div class="flex w-full items-center justify-between gap-2">
                <span>{preset?.name}</span>
              </div>
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
              return preset ? preset.name : "プリセットを選択...";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>

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

        <Show when={selectedPresetId()}>
          <Button
            class="text-red-500"
            onClick={() => handleDelete(Number(selectedPresetId()))}
            size="icon"
            variant="ghost"
          >
            ×
          </Button>
        </Show>
      </div>
    </div>
  );
}
