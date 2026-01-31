import { For, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { SearchCriterion, SearchGroup } from "~/domain/media/schemas";
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
};

export function ProSearchBuilder(props: Props) {
  // Ensure we have a root group if value is null
  const rootGroup = (): SearchGroup =>
    props.value || {
      type: "group",
      operator: "and",
      children: [],
    };

  const updateRoot = (newGroup: SearchGroup) => {
    props.onChange(newGroup);
  };

  return (
    <div class={cn("space-y-4", props.className)}>
      <GroupBuilder
        depth={0}
        group={rootGroup()}
        isRoot
        onChange={updateRoot} // Root removal clears everything
        onRemove={() => props.onChange(null)}
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
                if (val)
                  props.onChange({ ...props.group, operator: val as any });
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
            <span class="text-muted-foreground text-sm whitespace-nowrap">
              条件グループ
            </span>
          </div>

          <div class="flex flex-col gap-2 w-full">
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
                class="text-red-500 w-full"
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
          <For each={props.group.children}>
            {(child, index) => (
              <Show
                fallback={
                  <CriterionBuilder
                    criterion={child as SearchCriterion}
                    onChange={(c) => updateChild(index(), c)}
                    onRemove={() => removeChild(index())}
                  />
                }
                when={child.type === "group"}
              >
                <GroupBuilder
                  depth={props.depth + 1}
                  group={child as SearchGroup}
                  onChange={(g) => updateChild(index(), g)}
                  onRemove={() => removeChild(index())}
                />
              </Show>
            )}
          </For>
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

function CriterionBuilder(props: {
  criterion: SearchCriterion;
  onChange: (c: SearchCriterion) => void;
  onRemove: () => void;
}) {
  return (
    <div class="flex flex-col gap-2 rounded-md bg-muted/20 p-2">
      <Select
        itemComponent={(itemProps) => (
          <SelectItem item={itemProps.item}>
            {TARGET_LABELS[itemProps.item.rawValue]}
          </SelectItem>
        )}
        onChange={(val) => {
          if (val) props.onChange({ ...props.criterion, target: val as any });
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
          if (val) props.onChange({ ...props.criterion, operator: val as any });
        }}
        options={Object.keys(OPERATOR_LABELS)}
        value={props.criterion.operator}
      >
        <SelectTrigger class="w-full">
          <SelectValue<string>>
            {(state) => OPERATOR_LABELS[state.selectedOption()]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>

      <Input
        class="w-full"
        onInput={(e) =>
          props.onChange({ ...props.criterion, value: e.currentTarget.value })
        }
        placeholder="値..."
        value={props.criterion.value as string}
      />

      <Button
        class="text-red-500 w-full"
        onClick={props.onRemove}
        variant="ghost"
      >
        削除
      </Button>
    </div>
  );
}
