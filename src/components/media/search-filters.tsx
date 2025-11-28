import { createSignal, For, Show } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
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
import type { TagResponse } from "~/domain/tags/schemas";
import { cn } from "~/presentation/utils/cn";

export type SearchFilterState = {
  searchQuery: string;
  selectedTags: string[];
  excludeTags: string[];
  tagMode: "and" | "or";
  selectedProjects: number[];
  selectedIps: number[];
  selectedCharacters: number[];
  sortBy: "date" | "name" | "size";
  sortOrder: "asc" | "desc";
};

type SearchFiltersProps = {
  state: SearchFilterState;
  setState: SetStoreFunction<SearchFilterState>;
  tags: TagResponse[] | undefined;
  projects: Project[] | undefined;
  ips: Ip[] | undefined;
  characters: Character[] | undefined;
  onSearch?: () => void;
  className?: string;
};

// Separate component to avoid hydration issues when reusing JSX variable
function CommandContent<T>(props: {
  items: T[] | undefined;
  placeholder?: string;
  onSelect: (item: T) => void;
  getItemLabel: (item: T) => string;
  getItemDescription?: (item: T) => string | undefined | null;
  listMaxHeightClass?: string; // New prop
}) {
  return (
    <Command>
      <CommandInput placeholder={props.placeholder || "検索..."} />
      <CommandList class={props.listMaxHeightClass || "max-h-[150px]"}>
        <CommandEmpty>見つかりません</CommandEmpty>
        <CommandGroup>
          <For each={props.items}>
            {(item) => (
              <CommandItem
                onSelect={() => {
                  props.onSelect(item);
                }}
              >
                <div class="flex flex-col">
                  <span>{props.getItemLabel(item)}</span>
                  <Show when={props.getItemDescription?.(item)}>
                    <span class="text-muted-foreground text-xs">
                      {props.getItemDescription?.(item)}
                    </span>
                  </Show>
                </div>
              </CommandItem>
            )}
          </For>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

// Generic Filter Section Component
function FilterSection<T>(props: {
  label: string;
  items: T[] | undefined;
  selectedItems: (string | number)[];
  onSelect: (item: T) => void;
  onRemove: (id: string | number) => void;
  getItemKey: (item: T) => string | number;
  getItemLabel: (item: T) => string;
  getItemDescription?: (item: T) => string | undefined | null;
  placeholder?: string;
  badgeVariant?: "default" | "destructive" | "secondary" | "outline";
  usePopover?: boolean; // New prop to control Popover usage
  listMaxHeightClass?: string; // New prop
}) {
  const [open, setOpen] = createSignal(false);

  return (
    <div class="space-y-2">
      <Label>{props.label}</Label>
      <div class="flex flex-wrap gap-2">
        <For each={props.selectedItems}>
          {(id) => {
            const item = props.items?.find(
              (i) => props.getItemKey(i) === id
            ) as T;
            return (
              <Badge
                class="cursor-pointer"
                variant={props.badgeVariant || "default"}
              >
                {item ? props.getItemLabel(item) : id}
                <button
                  class="ml-1 hover:text-red-500"
                  onClick={() => props.onRemove(id)}
                  type="button"
                >
                  ×
                </button>
              </Badge>
            );
          }}
        </For>
        {props.usePopover === false ? (
          // Render Command directly if usePopover is false
          <div class="w-full">
            <CommandContent
              getItemDescription={props.getItemDescription}
              getItemLabel={props.getItemLabel}
              items={props.items}
              listMaxHeightClass={props.listMaxHeightClass}
              onSelect={props.onSelect}
              placeholder={props.placeholder}
            />
          </div>
        ) : (
          // Default to Popover behavior
          <Popover onOpenChange={setOpen} open={open()}>
            <PopoverTrigger as={Button} size="sm" variant="outline">
              + 追加
            </PopoverTrigger>
            <PopoverContent align="start" class="p-0" side="bottom">
              <CommandContent
                getItemDescription={props.getItemDescription}
                getItemLabel={props.getItemLabel}
                items={props.items}
                listMaxHeightClass={props.listMaxHeightClass || "max-h-[150px]"}
                onSelect={(item) => {
                  props.onSelect(item);
                  setOpen(false); // Close popover after selection
                }}
                placeholder={props.placeholder}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export function SearchFilters(props: SearchFiltersProps) {
  const addTag = (tagName: string) => {
    if (!props.state.selectedTags.includes(tagName)) {
      props.setState("selectedTags", [...props.state.selectedTags, tagName]);
    }
  };

  const removeTag = (tagName: string) => {
    props.setState(
      "selectedTags",
      props.state.selectedTags.filter((t) => t !== tagName)
    );
  };

  const addExcludeTag = (tagName: string) => {
    if (!props.state.excludeTags.includes(tagName)) {
      props.setState("excludeTags", [...props.state.excludeTags, tagName]);
    }
  };

  const removeExcludeTag = (tagName: string) => {
    props.setState(
      "excludeTags",
      props.state.excludeTags.filter((t) => t !== tagName)
    );
  };

  return (
    <div class={cn("space-y-4", props.className)}>
      {/* Filename Search */}
      <div class="space-y-2">
        <Label>ファイル名検索</Label>
        <Input
          onInput={(e) => props.setState("searchQuery", e.currentTarget.value)}
          placeholder="ファイル名を入力..."
          type="text"
          value={props.state.searchQuery}
        />
      </div>

      {/* Tag Selection */}
      <FilterSection
        badgeVariant="default"
        getItemKey={(tag) => tag.name}
        getItemLabel={(tag) => tag.name}
        items={props.tags}
        label="タグ (含む)"
        onRemove={(tag) => removeTag(tag)}
        onSelect={(tag) => addTag(tag.name)}
        placeholder="タグを検索..."
        selectedItems={props.state.selectedTags}
      />

      {/* Tag Mode */}
      <div class="space-y-2">
        <Label>タグマッチモード</Label>
        <Select
          itemComponent={(itemProps) => (
            <SelectItem item={itemProps.item}>
              {itemProps.item.rawValue === "and"
                ? "すべて含む (AND)"
                : "いずれかを含む (OR)"}
            </SelectItem>
          )}
          onChange={(value) => props.setState("tagMode", value || "and")}
          options={["and", "or"]}
          placeholder="モードを選択"
          value={props.state.tagMode}
        >
          <SelectTrigger>
            <SelectValue<string>>
              {(state) =>
                state.selectedOption() === "and"
                  ? "すべて含む (AND)"
                  : "いずれかを含む (OR)"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      </div>

      {/* Exclude Tags */}
      <FilterSection
        badgeVariant="destructive"
        getItemKey={(tag) => tag.name}
        getItemLabel={(tag) => tag.name}
        items={props.tags}
        label="除外タグ"
        onRemove={(tag) => removeExcludeTag(tag)}
        onSelect={(tag) => addExcludeTag(tag.name)}
        placeholder="除外タグを検索..."
        selectedItems={props.state.excludeTags}
      />

      {/* Project Filter */}
      <FilterSection
        badgeVariant="secondary"
        getItemDescription={(project) => project.description}
        getItemKey={(project) => project.id}
        getItemLabel={(project) => project.name}
        items={props.projects}
        label="プロジェクト"
        onRemove={(id) =>
          props.setState(
            "selectedProjects",
            props.state.selectedProjects.filter((pId) => pId !== id)
          )
        }
        onSelect={(project) => {
          if (!props.state.selectedProjects.includes(project.id)) {
            props.setState("selectedProjects", [
              ...props.state.selectedProjects,
              project.id,
            ]);
          }
        }}
        placeholder="プロジェクトを検索..."
        selectedItems={props.state.selectedProjects}
      />

      {/* IP Filter */}
      <FilterSection
        badgeVariant="secondary"
        getItemDescription={(ip) => ip.description}
        getItemKey={(ip) => ip.id}
        getItemLabel={(ip) => ip.name}
        items={props.ips}
        label="IP"
        onRemove={(id) =>
          props.setState(
            "selectedIps",
            props.state.selectedIps.filter((iId) => iId !== id)
          )
        }
        onSelect={(ip) => {
          if (!props.state.selectedIps.includes(ip.id)) {
            props.setState("selectedIps", [...props.state.selectedIps, ip.id]);
          }
        }}
        placeholder="IPを検索..."
        selectedItems={props.state.selectedIps}
      />

      {/* Character Filter */}
      <FilterSection
        badgeVariant="secondary"
        getItemDescription={(char) => char.description}
        getItemKey={(char) => char.id}
        getItemLabel={(char) => char.name}
        items={props.characters}
        label="キャラクター"
        onRemove={(id) =>
          props.setState(
            "selectedCharacters",
            props.state.selectedCharacters.filter((cId) => cId !== id)
          )
        }
        onSelect={(char) => {
          if (!props.state.selectedCharacters.includes(char.id)) {
            props.setState("selectedCharacters", [
              ...props.state.selectedCharacters,
              char.id,
            ]);
          }
        }}
        placeholder="キャラクターを検索..."
        selectedItems={props.state.selectedCharacters}
      />

      {/* Sort Options */}
      <div class="space-y-2">
        <Label>ソート</Label>
        <div class="grid grid-cols-2 gap-2">
          <Select
            itemComponent={(itemProps) => {
              const getSortLabel = (value: string) => {
                if (value === "date") {
                  return "作成日";
                }
                if (value === "name") {
                  return "ファイル名";
                }
                return "サイズ";
              };
              return (
                <SelectItem item={itemProps.item}>
                  {getSortLabel(itemProps.item.rawValue)}
                </SelectItem>
              );
            }}
            onChange={(value) => props.setState("sortBy", value || "date")}
            options={["date", "name", "size"]}
            placeholder="項目"
            value={props.state.sortBy}
          >
            <SelectTrigger>
              <SelectValue<string>>
                {(state) => {
                  const value = state.selectedOption();
                  if (value === "date") {
                    return "作成日";
                  }
                  if (value === "name") {
                    return "ファイル名";
                  }
                  return "サイズ";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
          <Select
            itemComponent={(itemProps) => (
              <SelectItem item={itemProps.item}>
                {itemProps.item.rawValue === "asc" ? "昇順" : "降順"}
              </SelectItem>
            )}
            onChange={(value) => props.setState("sortOrder", value || "desc")}
            options={["asc", "desc"]}
            placeholder="順序"
            value={props.state.sortOrder}
          >
            <SelectTrigger>
              <SelectValue<string>>
                {(state) =>
                  state.selectedOption() === "asc" ? "昇順" : "降順"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </div>
      </div>

      {props.onSearch && (
        <Button class="w-full" onClick={props.onSearch}>
          検索
        </Button>
      )}
    </div>
  );
}
