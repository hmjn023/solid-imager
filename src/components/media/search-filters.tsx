import { createSignal, For } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemLabel,
} from "~/components/ui/combobox";
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
import type { TagResponse } from "~/domain/tags/schemas";
import { cn } from "~/presentation/utils/cn";

export type SearchFilterState = {
  searchQuery: string;
  selectedTags: string[];
  excludeTags: string[];
  tagMode: "and" | "or";
  selectedProjects: string[];
  selectedIps: string[];
  selectedCharacters: string[];
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

// Generic Filter Section Component
function FilterSection<T>(props: {
  label: string;
  items: T[] | undefined;
  selectedItems: string[];
  onSelect: (item: T) => void;
  onRemove: (id: string) => void;
  getItemKey: (item: T) => string;
  getItemLabel: (item: T) => string;
  getItemDescription?: (item: T) => string | undefined | null;
  placeholder?: string;
  badgeVariant?: "default" | "destructive" | "secondary" | "outline";
}) {
  const [value, _setValue] = createSignal<T | null>(null);

  return (
    <div class="space-y-2">
      <Label>{props.label}</Label>
      <div class="mb-2 flex flex-wrap gap-2">
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
      </div>
      <Combobox<T>
        itemComponent={(itemProps) => (
          <ComboboxItem item={itemProps.item}>
            <ComboboxItemLabel>{itemProps.item.textValue}</ComboboxItemLabel>
          </ComboboxItem>
        )}
        onChange={(val) => {
          if (val) {
            props.onSelect(val);
            // setValue(null); // Keep the selection visible
          }
        }}
        optionLabel={props.getItemLabel}
        options={props.items || []}
        optionTextValue={props.getItemLabel}
        optionValue={(item) => props.getItemKey(item)}
        placeholder={props.placeholder}
        triggerMode="focus"
        value={value()}
      >
        <ComboboxControl>
          <ComboboxInput />
        </ComboboxControl>
        <ComboboxContent class="max-h-[300px]" />
      </Combobox>
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
        onRemove={(id) => removeTag(id)}
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
        onRemove={(id) => removeExcludeTag(id)}
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
        onRemove={(name) =>
          props.setState(
            "selectedProjects",
            props.state.selectedProjects.filter((pName) => pName !== name)
          )
        }
        onSelect={(project) => {
          if (!props.state.selectedProjects.includes(project.name)) {
            props.setState("selectedProjects", [
              ...props.state.selectedProjects,
              project.name,
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
        onRemove={(name) =>
          props.setState(
            "selectedIps",
            props.state.selectedIps.filter((iName) => iName !== name)
          )
        }
        onSelect={(ip) => {
          if (!props.state.selectedIps.includes(ip.name)) {
            props.setState("selectedIps", [
              ...props.state.selectedIps,
              ip.name,
            ]);
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
        onRemove={(name) =>
          props.setState(
            "selectedCharacters",
            props.state.selectedCharacters.filter((cName) => cName !== name)
          )
        }
        onSelect={(char) => {
          if (!props.state.selectedCharacters.includes(char.name)) {
            props.setState("selectedCharacters", [
              ...props.state.selectedCharacters,
              char.name,
            ]);
          }
        }}
        placeholder="キャラクターを検索..."
        selectedItems={props.state.selectedCharacters}
      />

      {props.onSearch && (
        <Button class="w-full" onClick={props.onSearch}>
          検索
        </Button>
      )}
    </div>
  );
}
