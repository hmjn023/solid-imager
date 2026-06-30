import type { Author } from "@solid-imager/core/domain/authors/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type {
	SearchCriterion,
	SearchGroup,
} from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { createMemo, Index, Match, Show, Switch } from "solid-js";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import {
	Combobox,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
	VirtualComboboxContent,
} from "./combobox";
import { Input } from "./input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { cn } from "./utils/cn";
import { parseSelectValue } from "./utils/parse-select-value";

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

const STRING_OPERATORS = [
	"equals",
	"contains",
	"startsWith",
	"endsWith",
	"isEmpty",
	"isNotEmpty",
];
const NUMERIC_OPERATORS = ["equals", "gt", "gte", "lt", "lte"];
const RELATIONAL_OPERATORS = ["equals", "contains", "in", "notIn"];
const BOOLEAN_OPERATORS = ["equals"];

type Props = {
	value: SearchGroup | null;
	onChange: (value: SearchGroup | null) => void;
	tags?: TagResponse[];
	projects?: Project[];
	ips?: Ip[];
	characters?: Character[];
	authors?: Author[];
	className?: string;
};

type RelationOption = TagResponse | Project | Ip | Character | Author;

export function ProSearchBuilder(props: Props) {
	const rootGroup = createMemo<SearchGroup>(
		() =>
			props.value || {
				type: "group",
				operator: "and",
				children: [],
			},
	);

	return (
		<div class={cn("space-y-4", props.className)}>
			<GroupBuilder
				authors={props.authors}
				characters={props.characters}
				depth={0}
				group={rootGroup()}
				ips={props.ips}
				isRoot
				onChange={props.onChange}
				onRemove={() => props.onChange(null)}
				projects={props.projects}
				tags={props.tags}
			/>
		</div>
	);
}

function getValidOperators(target: string) {
	if (
		["fileName", "filePath", "description", "keyword", "folder"].includes(
			target,
		)
	) {
		return STRING_OPERATORS;
	}
	if (["tag", "project", "ip", "character", "author"].includes(target)) {
		return RELATIONAL_OPERATORS;
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
	if (["aiGenerated", "favorite", "isArchived"].includes(target)) {
		return BOOLEAN_OPERATORS;
	}
	return Object.keys(OPERATOR_LABELS);
}

function GroupBuilder(props: {
	group: SearchGroup;
	onChange: (value: SearchGroup) => void;
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
		const nextChildren = [...props.group.children];
		if (type === "group") {
			nextChildren.push({
				type: "group",
				operator: "and",
				children: [],
			});
		} else {
			nextChildren.push({
				type: "criterion",
				target: "fileName",
				operator: "contains",
				value: "",
			});
		}
		props.onChange({ ...props.group, children: nextChildren });
	};

	const updateChild = (index: number, child: SearchCriterion | SearchGroup) => {
		const nextChildren = [...props.group.children];
		nextChildren.splice(index, 1, child);
		props.onChange({ ...props.group, children: nextChildren });
	};

	const removeChild = (index: number) => {
		const nextChildren = [...props.group.children];
		nextChildren.splice(index, 1);
		props.onChange({ ...props.group, children: nextChildren });
	};

	return (
		<Card
			class={cn(
				"border-l-2",
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
							onChange={(value) => {
								if (value) {
									props.onChange({
										...props.group,
										operator: parseSelectValue(value, ["and", "or"], "and"),
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
						<Show when={!props.isRoot}>
							<Button
								class="w-full text-red-500"
								onClick={props.onRemove}
								size="sm"
								variant="ghost"
							>
								削除
							</Button>
						</Show>
					</div>
				</div>

				<div class="space-y-2 border-border border-l pl-2 sm:pl-4">
					<Index each={props.group.children}>
						{(child, index) => {
							const c = child();
							return c.type === "group" ? (
								<GroupBuilder
									authors={props.authors}
									characters={props.characters}
									depth={props.depth + 1}
									group={c}
									ips={props.ips}
									onChange={(value) => updateChild(index, value)}
									onRemove={() => removeChild(index)}
									projects={props.projects}
									tags={props.tags}
								/>
							) : (
								<CriterionBuilder
									authors={props.authors}
									characters={props.characters}
									criterion={c}
									ips={props.ips}
									onChange={(value) => updateChild(index, value)}
									onRemove={() => removeChild(index)}
									projects={props.projects}
									tags={props.tags}
								/>
							);
						}}
					</Index>
					<Show when={props.group.children.length === 0}>
						<div class="p-2 text-muted-foreground text-sm italic">
							条件がありません。「+ 条件」ボタンで追加してください。
						</div>
					</Show>
				</div>
			</CardContent>
		</Card>
	);
}

function CriterionBuilder(props: {
	criterion: SearchCriterion;
	onChange: (value: SearchCriterion) => void;
	onRemove: () => void;
	tags?: TagResponse[];
	projects?: Project[];
	ips?: Ip[];
	characters?: Character[];
	authors?: Author[];
}) {
	const getAuthorLabel = (author: Author) =>
		author.accountId
			? `${author.name}：(twitter)${author.accountId}`
			: author.name;

	const autocompleteItems = createMemo<RelationOption[] | undefined>(() => {
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
				return undefined;
		}
	});

	const isNumericTarget = createMemo(() =>
		[
			"rating",
			"viewCount",
			"fileSize",
			"createdAt",
			"width",
			"height",
		].includes(props.criterion.target),
	);
	const isBooleanTarget = createMemo(() =>
		["aiGenerated", "favorite", "isArchived"].includes(props.criterion.target),
	);

	return (
		<div class="flex flex-col gap-2 rounded-md bg-muted/20 p-2">
			<Select
				itemComponent={(itemProps) => (
					<SelectItem item={itemProps.item}>
						{TARGET_LABELS[itemProps.item.rawValue]}
					</SelectItem>
				)}
				onChange={(value) => {
					if (!value || value === props.criterion.target) {
						return;
					}
					const operators = getValidOperators(value);
					props.onChange({
						...props.criterion,
						target: parseSelectValue(
							value,
							Object.keys(
								TARGET_LABELS,
							) as readonly SearchCriterion["target"][],
							"fileName",
						),
						operator: parseSelectValue(
							operators[0] || "equals",
							[
								"equals",
								"contains",
								"startsWith",
								"endsWith",
								"gt",
								"gte",
								"lt",
								"lte",
								"in",
								"notIn",
								"isEmpty",
								"isNotEmpty",
							] as readonly SearchCriterion["operator"][],
							"equals",
						),
						value: ["aiGenerated", "favorite", "isArchived"].includes(value)
							? true
							: "",
					});
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
				onChange={(value) => {
					if (value) {
						props.onChange({
							...props.criterion,
							operator: parseSelectValue(
								value,
								[
									"equals",
									"contains",
									"startsWith",
									"endsWith",
									"gt",
									"gte",
									"lt",
									"lte",
									"in",
									"notIn",
									"isEmpty",
									"isNotEmpty",
								] as readonly SearchCriterion["operator"][],
								"equals",
							),
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
				<Match
					when={
						props.criterion.operator === "equals" &&
						autocompleteItems() &&
						(autocompleteItems()?.length ?? 0) > 0
					}
				>
					<Combobox<RelationOption>
						itemComponent={(itemProps) => (
							<ComboboxItem item={itemProps.item}>
								<ComboboxItemLabel>
									{itemProps.item.textValue}
								</ComboboxItemLabel>
							</ComboboxItem>
						)}
						onChange={(value) => {
							if (value) {
								props.onChange({ ...props.criterion, value: value.name });
							}
						}}
						defaultFilter="contains"
						optionLabel={(item) =>
							item
								? "accountId" in item
									? getAuthorLabel(item)
									: item.name
								: ""
						}
						options={autocompleteItems() ?? []}
						optionTextValue={(item) =>
							item
								? "accountId" in item
									? getAuthorLabel(item)
									: item.name
								: ""
						}
						optionValue={(item) => item.id}
						placeholder="検索..."
						triggerMode="focus"
						value={(autocompleteItems() || []).find(
							(item) => item.name === props.criterion.value,
						)}
					>
						<ComboboxControl>
							<ComboboxInput />
						</ComboboxControl>
						<VirtualComboboxContent class="max-h-[300px]" />
					</Combobox>
				</Match>

				<Match when={isBooleanTarget()}>
					<Select
						itemComponent={(itemProps) => (
							<SelectItem item={itemProps.item}>
								{itemProps.item.rawValue === "true" ? "true" : "false"}
							</SelectItem>
						)}
						onChange={(value) =>
							props.onChange({
								...props.criterion,
								value: value === "true",
							})
						}
						options={["true", "false"]}
						value={String(Boolean(props.criterion.value))}
					>
						<SelectTrigger class="w-full">
							<SelectValue<string>>
								{(state) => state.selectedOption()}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</Match>

				<Match when={["in", "notIn"].includes(props.criterion.operator)}>
					<div class="space-y-1">
						<Input
							class="w-full"
							onInput={(event) =>
								props.onChange({
									...props.criterion,
									value: event.currentTarget.value
										.split(",")
										.map((value) => value.trim())
										.filter((value) => value.length > 0),
								})
							}
							placeholder="値をカンマ区切りで入力"
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

				<Match
					when={["isEmpty", "isNotEmpty"].includes(props.criterion.operator)}
				>
					<div class="rounded-md border border-dashed p-2 text-center text-muted-foreground text-xs italic">
						この条件に値は不要です
					</div>
				</Match>

				<Match when={true}>
					<Input
						class="w-full"
						onInput={(event) =>
							props.onChange({
								...props.criterion,
								value: isNumericTarget()
									? Number(event.currentTarget.value)
									: event.currentTarget.value,
							})
						}
						placeholder="値..."
						type={isNumericTarget() ? "number" : "text"}
						value={
							Array.isArray(props.criterion.value)
								? props.criterion.value.join(", ")
								: String(props.criterion.value ?? "")
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
