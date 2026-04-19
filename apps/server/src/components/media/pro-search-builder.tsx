import type { Author } from "@solid-imager/core/domain/authors/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type {
	SearchCriterion,
	SearchGroup,
} from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { Button } from "@solid-imager/ui/button";
import { Card, CardContent } from "@solid-imager/ui/card";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
} from "@solid-imager/ui/combobox";
import { Input } from "@solid-imager/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@solid-imager/ui/select";
import { cn } from "@solid-imager/ui/utils/cn";
import { createMemo, Index, Match, Show, Switch } from "solid-js";

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
	authors?: Author[];
};

export function ProSearchBuilder(props: Props) {
	// Ensure we have a root group if value is null
	const rootGroup = createMemo<SearchGroup>(
		() =>
			props.value || {
				type: "group",
				operator: "and",
				children: [],
			},
	);

	const updateRoot = (newGroup: SearchGroup) => {
		props.onChange(newGroup);
	};

	return (
		<div class={cn("space-y-4", props.className)}>
			<GroupBuilder
				authors={props.authors}
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
	authors?: Author[];
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
		newChildren.splice(index, 1, child);
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
				"border-l-2", // Reduce border width
				props.depth % 2 === 0 ? "border-l-blue-500" : "border-l-green-500",
			)}
		>
			<CardContent class="space-y-4 p-2 sm:p-4">
				<div class="flex flex-col gap-2">
					<div class="flex flex-wrap items-center gap-2">
						<Select
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{itemProps.item.rawValue.toUpperCase()}
								</SelectItem>
							)}
							onChange={(val) => {
								if (val) {
									props.onChange({
										...props.group,
										operator: val as SearchGroup["operator"],
									});
								}
							}}
							options={["and", "or"]}
							value={props.group.operator}
						>
							<SelectTrigger class="w-20 sm:w-24">
								<SelectValue<string>>
									{(state) => state.selectedOption().toUpperCase()}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
						<span class="text-muted-foreground text-sm">条件グループ</span>
					</div>

					<div class="flex w-full flex-col gap-2">
						<div class="flex flex-wrap gap-2">
							<Button
								class="flex-1 whitespace-nowrap"
								onClick={() => addChild("criterion")}
								size="sm"
								variant="outline"
							>
								+ 条件
							</Button>
							<Button
								class="flex-1 whitespace-nowrap"
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

				<div class="space-y-2 border-border border-l pl-2 sm:pl-4">
					<Index each={props.group.children}>
						{(child, index) => (
							<Show
								fallback={
									<CriterionBuilder
										authors={props.authors}
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
									authors={props.authors}
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
	characters?: Character[];
	authors?: Author[];
	ips?: Ip[];
	projects?: Project[];
	tags?: TagResponse[];
}) {
	const getAuthorLabel = (author: Author) =>
		author.accountId
			? `${author.name}: (twitter)${author.accountId}`
			: author.name;

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
			case "author":
				return props.authors;
			default:
				return;
		}
	});

	const getValidOperators = (target: string) => {
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
		if (["tag", "project", "ip", "character", "author"].includes(target)) {
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
						const operators = getValidOperators(val);
						// Default to the first valid operator
						const newOp = operators[0] || "equals";

						props.onChange({
							...props.criterion,
							target: val as SearchCriterion["target"],
							operator: newOp as SearchCriterion["operator"],
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
						props.onChange({
							...props.criterion,
							operator: val as SearchCriterion["operator"],
						});
					}
				}}
				options={getValidOperators(props.criterion.target)}
				value={props.criterion.operator}
			>
				<SelectTrigger class="w-full">
					<SelectValue<string>>
						{(state) => OPERATOR_LABELS[state.selectedOption()]}
					</SelectValue>
				</SelectTrigger>
				<SelectContent />
			</Select>

			<Switch>
				{/* Case 1: Autocomplete available for "equals" */}
				<Match
					when={props.criterion.operator === "equals" && autocompleteItems()}
				>
					<Combobox
						itemComponent={(itemProps) => (
							<ComboboxItem item={itemProps.item}>
								<ComboboxItemLabel>
									{itemProps.item.textValue}
								</ComboboxItemLabel>
							</ComboboxItem>
						)}
						onChange={(
							val: { name: string; accountId?: string | null } | null,
						) => {
							if (val) {
								props.onChange({ ...props.criterion, value: val.name });
							}
						}}
						optionLabel={(item) =>
							props.criterion.target === "author"
								? getAuthorLabel(item as Author)
								: (item as { name: string }).name
						}
						options={autocompleteItems() || []}
						optionTextValue={(item) =>
							props.criterion.target === "author"
								? getAuthorLabel(item as Author)
								: (item as { name: string }).name
						}
						optionValue={(item: { name: string }) => item.name}
						placeholder="検索..."
						triggerMode="focus"
						value={(autocompleteItems() || []).find(
							(i) => i.name === props.criterion.value,
						)}
					>
						<ComboboxControl>
							<ComboboxInput />
						</ComboboxControl>
						<ComboboxContent class="max-h-[300px]" />
					</Combobox>
				</Match>

				{/* Case 2: Multi-value input for in/notIn operators */}
				<Match when={["in", "notIn"].includes(props.criterion.operator)}>
					<div class="space-y-1">
						<Input
							class="w-full"
							onInput={(e) =>
								props.onChange({
									...props.criterion,
									value: e.currentTarget.value
										.split(",")
										.map((v) => v.trim())
										.filter((v) => v !== ""),
								})
							}
							placeholder="値をカンマ区切りで入力 (例: val1, val2)"
							value={
								Array.isArray(props.criterion.value)
									? props.criterion.value.join(", ")
									: ""
							}
						/>
						<p class="text-muted-foreground text-xs">
							カンマ区切りで複数の値を指定できます
						</p>
					</div>
				</Match>

				{/* Case 3: No input needed for emptiness checks */}
				<Match
					when={["isEmpty", "isNotEmpty"].includes(props.criterion.operator)}
				>
					<div class="rounded-md border border-dashed p-2 text-center text-muted-foreground text-xs italic">
						この条件に値は不要です
					</div>
				</Match>

				{/* Default: Generic Input */}
				<Match when={true}>
					<Input
						class="w-full"
						onInput={(e) =>
							props.onChange({
								...props.criterion,
								value: e.currentTarget.value,
							})
						}
						placeholder="値..."
						value={
							(Array.isArray(props.criterion.value)
								? props.criterion.value.join(", ")
								: (props.criterion.value ?? "")) as string
						}
					/>
				</Match>
			</Switch>

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
