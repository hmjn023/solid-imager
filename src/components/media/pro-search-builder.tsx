import { createMemo, Index, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemLabel,
} from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Character } from "~/domain/characters/schemas";
import type { Ip } from "~/domain/ips/schemas";
import type { SearchCriterion, SearchGroup } from "~/domain/media/schemas";
import type { Project } from "~/domain/projects/schemas";
import type { TagResponse } from "~/domain/tags/schemas";
import { cn } from "~/presentation/utils/cn";

// Labels for targets
const TARGET_LABELS: Record<string, string> = {
  fileName: "ファイル名",
  filePath: "ファイルパス",
  description: "説明",
  keyword: "キーワード",
  tag: "タグ",
  author: "作者",
  project: "プロジェクト",
  ip: "IP",
  character: "キャラクター",
  folder: "フォルダ",
  rating: "評価",
  viewCount: "閲覧数",
  fileSize: "ファイルサイズ",
  createdAt: "作成日",
  aiGenerated: "AI生成",
};

// Labels for operators
const OPERATOR_LABELS: Record<string, string> = {
  equals: "と一致する",
  contains: "を含む",
  startsWith: "で始まる",
  endsWith: "で終わる",
  gt: "より大きい (>)",
  gte: "以上 (>=)",
  lt: "より小さい (<)",
  lte: "以下 (<=)",
  in: "のいずれか",
  notIn: "のいずれでもない",
  isEmpty: "が空",
  isNotEmpty: "が空でない",
};

type Props = {
  value: SearchGroup | null;
  onChange: (value: SearchGroup | null) => void;
  className?: string;
  tags?: TagResponse[];
  projects?: Project[];
  ips?: Ip[];
  characters?: Character[];
};

export function ProSearchBuilder(props: Props) {
  // Ensure we have a root group if value is null
  const rootGroup = createMemo<SearchGroup>(
    () =>
      props.value || {
        type: "group",
        operator: "and",
        children: [],
      }
  );

  // ...

  const updateRoot = (newGroup: SearchGroup) => {
    props.onChange(newGroup);
  };

  return (
    <div class={cn("space-y-4", props.className)}>
      <GroupBuilder
        characters={props.characters}
        depth={0}
        group={rootGroup()}
        ips={props.ips} // Root removal clears everything
        isRoot
        onChange={updateRoot}
        onRemove={() => props.onChange(null)}
        projects={props.projects}
        tags={props.tags}
      />
    </div>
  );
}

function GroupBuilder(props: {
  group: SearchGroup;
  onChange: (g: SearchGroup) => void;
  onRemove: () => void;
  depth: number;
  isRoot?: boolean;
  tags?: TagResponse[];
  projects?: Project[];
  ips?: Ip[];
  characters?: Character[];
}) {
  const addChild = (type: "criterion" | "group") => {
    const newChildren = [...props.group.children];
    if (type === "group") {
      newChildren.push({
        type: "group",
        operator: "and",
        children: [],
      });
    } else {
      newChildren.push({
        type: "criterion",
        target: "fileName",
        operator: "contains",
        value: "",
      });
    }
    props.onChange({ ...props.group, children: newChildren });
  };

  const updateChild = (index: number, child: SearchGroup | SearchCriterion) => {
    const newChildren = [...props.group.children];
    newChildren[index] = child;
    props.onChange({ ...props.group, children: newChildren });
  };

  const removeChild = (index: number) => {
    const newChildren = [...props.group.children];
    newChildren.splice(index, 1);
    props.onChange({ ...props.group, children: newChildren });
  };

  return (
    <Card
      class={cn(
        "border-l-4",
        props.depth % 2 === 0 ? "border-l-blue-500" : "border-l-green-500"
      )}
    >
      <CardContent class="space-y-4 p-4">
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <Select
              itemComponent={(itemProps) => (
                <SelectItem item={itemProps.item}>
                  {itemProps.item.rawValue.toUpperCase()}
                </SelectItem>
              )}
              onChange={(val) => {
                if (val) {
                  // biome-ignore lint/suspicious/noExplicitAny: dynamic operator assignment
                  props.onChange({ ...props.group, operator: val as any });
                }
              }}
              options={["and", "or"]}
              value={props.group.operator}
            >
              <SelectTrigger class="w-24">
                <SelectValue<string>>
                  {(state) => state.selectedOption().toUpperCase()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
            <span class="whitespace-nowrap text-muted-foreground text-sm">
              条件グループ
            </span>
          </div>

          <div class="flex w-full flex-col gap-2">
            <div class="flex gap-2">
              <Button
                class="flex-1"
                onClick={() => addChild("criterion")}
                size="sm"
                variant="outline"
              >
                + 条件
              </Button>
              <Button
                class="flex-1"
                onClick={() => addChild("group")}
                size="sm"
                variant="outline"
              >
                + グループ
              </Button>
            </div>
            {!props.isRoot && (
              <Button
                class="w-full text-red-500"
                onClick={props.onRemove}
                size="sm"
                variant="ghost"
              >
                削除
              </Button>
            )}
          </div>
        </div>

        <div class="space-y-2 border-border border-l pl-4">
          <Index each={props.group.children}>
            {(child, index) => (
              <Show
                fallback={
                  <CriterionBuilder
                    characters={props.characters}
                    criterion={child() as SearchCriterion}
                    ips={props.ips}
                    onChange={(c) => updateChild(index, c)}
                    onRemove={() => removeChild(index)}
                    projects={props.projects}
                    tags={props.tags}
                  />
                }
                when={child().type === "group"}
              >
                <GroupBuilder
                  characters={props.characters}
                  depth={props.depth + 1}
                  group={child() as SearchGroup}
                  ips={props.ips}
                  onChange={(g) => updateChild(index, g)}
                  onRemove={() => removeChild(index)}
                  projects={props.projects}
                  tags={props.tags}
                />
              </Show>
            )}
          </Index>
          {props.group.children.length === 0 && (
            <div class="p-2 text-muted-foreground text-sm italic">
              条件がありません。「+ 条件」ボタンで追加してください。
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Constants for restricted operators
const STRING_OPERATORS = [
  "equals",
  "contains",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
];
const NUMERIC_OPERATORS = ["equals", "gt", "gte", "lt", "lte"];
const RELATIONAL_OPERATORS = ["equals", "contains", "in", "notIn"]; // contains for partial match on name
const BOOLEAN_OPERATORS = ["equals"];

function CriterionBuilder(props: {
  criterion: SearchCriterion;
  onChange: (c: SearchCriterion) => void;
  onRemove: () => void;
  tags?: TagResponse[];
  projects?: Project[];
  ips?: Ip[];
  characters?: Character[];
}) {
  // Helper to determine available items for autocomplete
  const autocompleteItems = createMemo(() => {
    switch (props.criterion.target) {
      case "tag":
        return props.tags;
      case "project":
        return props.projects;
      case "ip":
        return props.ips;
      case "character":
        return props.characters;
      default:
        return;
    }
  });

  const validOperators = () => {
    const target = props.criterion.target;
    // Fast path checks using sets or direct includes
    if (
      [
        "fileName",
        "filePath",
        "description",
        "keyword",
        "author",
        "folder",
      ].includes(target)
    ) {
      return STRING_OPERATORS;
    }
    if (
      [
        "rating",
        "viewCount",
        "fileSize",
        "createdAt",
        "width",
        "height",
      ].includes(target)
    ) {
      return NUMERIC_OPERATORS;
    }
    if (["tag", "project", "ip", "character"].includes(target)) {
      return RELATIONAL_OPERATORS;
    }
    if (["aiGenerated", "favorite", "isArchived"].includes(target)) {
      return BOOLEAN_OPERATORS;
    }
    return Object.keys(OPERATOR_LABELS);
  };

  return (
    <div class="flex flex-col gap-2 rounded-md bg-muted/20 p-2">
      <Select
        itemComponent={(itemProps) => (
          <SelectItem item={itemProps.item}>
            {TARGET_LABELS[itemProps.item.rawValue]}
          </SelectItem>
        )}
        onChange={(val) => {
          if (val && val !== props.criterion.target) {
            // Recalculate valid operators for the new target
            // We duplicate the logic here or just rely on the fact that we can pick a safe default
            // For simplicity, default to "contains" for string/relational, "equals" for others
            let newOp = "contains";
            if (
              [
                "rating",
                "viewCount",
                "fileSize",
                "createdAt",
                "aiGenerated",
                "favorite",
              ].includes(val)
            ) {
              newOp = "equals";
            }

            props.onChange({
              ...props.criterion,
              // biome-ignore lint/suspicious/noExplicitAny: dynamic target assignment
              target: val as any,
              // biome-ignore lint/suspicious/noExplicitAny: dynamic operator assignment
              operator: newOp as any,
              value: "", // Clear value on target change to prevent incompatible types
            });
          }
        }}
        options={Object.keys(TARGET_LABELS)}
        value={props.criterion.target}
      >
        <SelectTrigger class="w-full">
          <SelectValue<string>>
            {(state) => TARGET_LABELS[state.selectedOption()]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>

      <Select
        itemComponent={(itemProps) => (
          <SelectItem item={itemProps.item}>
            {OPERATOR_LABELS[itemProps.item.rawValue]}
          </SelectItem>
        )}
        onChange={(val) => {
          if (val && val !== props.criterion.operator) {
            // biome-ignore lint/suspicious/noExplicitAny: safe cast for UI selection
            props.onChange({ ...props.criterion, operator: val as any });
          }
        }}
        options={validOperators()}
        value={props.criterion.operator}
      >
        <SelectTrigger class="w-full">
          <SelectValue<string>>
            {(state) => OPERATOR_LABELS[state.selectedOption()]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>

      <Show
        fallback={
          <Input
            class="w-full"
            onInput={(e) =>
              props.onChange({
                ...props.criterion,
                value: e.currentTarget.value,
              })
            }
            placeholder="値..."
            value={props.criterion.value as string}
          />
        }
        when={props.criterion.operator === "equals" && autocompleteItems()}
      >
        <Combobox
          itemComponent={(itemProps) => (
            <ComboboxItem item={itemProps.item}>
              <ComboboxItemLabel>{itemProps.item.textValue}</ComboboxItemLabel>
            </ComboboxItem>
          )}
          // biome-ignore lint/suspicious/noExplicitAny: generic combobox usage
          onChange={(val: any) => {
            if (val) {
              props.onChange({ ...props.criterion, value: val.name });
            }
          }}
          // biome-ignore lint/suspicious/noExplicitAny: generic combobox item
          optionLabel={(item: any) => item.name}
          options={autocompleteItems() || []}
          // biome-ignore lint/suspicious/noExplicitAny: generic combobox item
          optionTextValue={(item: any) => item.name}
          // biome-ignore lint/suspicious/noExplicitAny: generic combobox item
          optionValue={(item: any) => item.name}
          placeholder="検索..."
          triggerMode="focus"
          value={(autocompleteItems() || []).find(
            // biome-ignore lint/suspicious/noExplicitAny: generic combobox item
            (i: any) => i.name === props.criterion.value
          )}
        >
          <ComboboxControl>
            <ComboboxInput />
          </ComboboxControl>
          <ComboboxContent class="max-h-[300px]" />
        </Combobox>
      </Show>

      <Button
        class="w-full text-red-500"
        onClick={props.onRemove}
        variant="ghost"
      >
        削除
      </Button>
    </div>
  );
}
