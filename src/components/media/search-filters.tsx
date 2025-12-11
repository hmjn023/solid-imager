import { createVirtualizer } from "@tanstack/solid-virtual";
import { createSignal, For, Show } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
  usePopover?: boolean;
};

// Virtualized Command List Component
function VirtualizedCommandContent<T>(props: {
  items: T[] | undefined;
  placeholder?: string;
  onSelect: (item: T) => void;
  getItemLabel: (item: T) => string;
  getItemDescription?: (item: T) => string | undefined | null;
  listMaxHeightClass?: string;
}) {
  const [query, setQuery] = createSignal("");
  let parentRef: HTMLDivElement | undefined;

  // Filter items locally based on query
  const filteredItems = () => {
    const items = props.items || [];
    const q = query().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((item) =>
      props.getItemLabel(item).toLowerCase().includes(q)
    );
  };

  const virtualizer = createVirtualizer({
    count: filteredItems().length,
    getScrollElement: () => parentRef || null,
    estimateSize: () => 36, // Approximate height of CommandItem
    overscan: 5,
  });

  return (
    <div class="flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground">
      <div class="flex items-center border-b px-3">
        {/* biome-ignore lint/a11y/noSvgWithoutTitle: Search icon */}
        <svg
          class="mr-2 size-4 shrink-0 opacity-50"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          class="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder={props.placeholder || "検索..."}
          value={query()}
        />
      </div>
      <div
        class={cn(
          "overflow-y-auto overflow-x-hidden",
          props.listMaxHeightClass || "max-h-[150px]"
        )}
        ref={(el) => {
          parentRef = el;
        }}
        style={{
          contain: "strict",
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          <Show when={filteredItems().length === 0}>
            <div class="py-6 text-center text-sm">見つかりません</div>
          </Show>
          <For each={virtualizer.getVirtualItems()}>
            {(virtualItem) => {
              const item = filteredItems()[virtualItem.index];
              return (
                <div
                  aria-selected={false}
                  class={cn(
                    "absolute top-0 left-0 w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={() => props.onSelect(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      props.onSelect(item);
                    }
                  }}
                  role="option" // Ideally this should be dynamic, but for now we just satisfy A11y
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  tabIndex={0}
                >
                  <div class="flex flex-col">
                    <span>{props.getItemLabel(item)}</span>
                    <Show when={props.getItemDescription?.(item)}>
                      <span class="text-muted-foreground text-xs">
                        {props.getItemDescription?.(item)}
                      </span>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
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
          // Render Virtual List directly if usePopover is false
          <div class="w-full">
            <VirtualizedCommandContent
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
          <Popover
            onOpenChange={setOpen}
            open={open()}
            placement="bottom-start"
          >
            <PopoverTrigger as={Button} size="sm" variant="outline">
              + 追加
            </PopoverTrigger>
            <PopoverContent class="p-0">
              <VirtualizedCommandContent
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
        onRemove={(id) => removeTag(id as string)}
        onSelect={(tag) => addTag(tag.name)}
        placeholder="タグを検索..."
        selectedItems={props.state.selectedTags}
        usePopover={props.usePopover}
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
        onRemove={(id) => removeExcludeTag(id as string)}
        onSelect={(tag) => addExcludeTag(tag.name)}
        placeholder="除外タグを検索..."
        selectedItems={props.state.excludeTags}
        usePopover={props.usePopover}
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
        usePopover={props.usePopover}
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
        usePopover={props.usePopover}
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
        usePopover={props.usePopover}
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
