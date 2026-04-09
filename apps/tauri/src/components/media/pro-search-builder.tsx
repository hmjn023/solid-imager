import type {
	SearchCriterion,
	SearchGroup,
} from "@solid-imager/core/domain/media/schemas";
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
import { createMemo, Index, Match, Show, Switch } from "solid-js";
import type { MockAssociation, MockAuthor } from "../../mocks/demo-data";
import type { TauriSearchFilterData } from "./search-filters";

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
	width: "幅",
	height: "高さ",
	aiGenerated: "AI生成",
	favorite: "お気に入り",
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
	filterData: TauriSearchFilterData;
	className?: string;
};

type RelationOption =
	| MockAssociation
	| MockAuthor
	| { id: string; name: string };

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
		<div class={props.className}>
			<GroupBuilder
				depth={0}
				filterData={props.filterData}
				group={rootGroup()}
				isRoot
				onChange={props.onChange}
				onRemove={() => props.onChange(null)}
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
	if (["aiGenerated", "favorite"].includes(target)) {
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
	filterData: TauriSearchFilterData;
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
			class={
				props.depth % 2 === 0
					? "border-l-2 border-l-blue-500"
					: "border-l-2 border-l-green-500"
			}
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
										operator: value as SearchGroup["operator"],
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
						{(child, index) => (
							<Show
								fallback={
									<CriterionBuilder
										criterion={child() as SearchCriterion}
										filterData={props.filterData}
										onChange={(value) => updateChild(index, value)}
										onRemove={() => removeChild(index)}
									/>
								}
								when={child().type === "group"}
							>
								<GroupBuilder
									depth={props.depth + 1}
									filterData={props.filterData}
									group={child() as SearchGroup}
									onChange={(value) => updateChild(index, value)}
									onRemove={() => removeChild(index)}
								/>
							</Show>
						)}
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
	filterData: TauriSearchFilterData;
}) {
	const getAuthorLabel = (author: MockAuthor) =>
		author.accountId ? `${author.name}: ${author.accountId}` : author.name;

	const autocompleteItems = createMemo<RelationOption[] | undefined>(() => {
		switch (props.criterion.target) {
			case "tag":
				return props.filterData.tags.map((tag) => ({ id: tag, name: tag }));
			case "project":
				return props.filterData.projects;
			case "ip":
				return props.filterData.ips;
			case "character":
				return props.filterData.characters;
			case "author":
				return props.filterData.authors;
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
		["aiGenerated", "favorite"].includes(props.criterion.target),
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
						target: value as SearchCriterion["target"],
						operator: (operators[0] || "equals") as SearchCriterion["operator"],
						value: ["aiGenerated", "favorite"].includes(value) ? true : "",
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
							operator: value as SearchCriterion["operator"],
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
								props.onChange({ ...props.criterion, value: value.id });
							}
						}}
						optionLabel={(item) =>
							"id" in item && "accountId" in item
								? getAuthorLabel(item as MockAuthor)
								: item.name
						}
						options={autocompleteItems() || []}
						optionTextValue={(item) =>
							"id" in item && "accountId" in item
								? getAuthorLabel(item as MockAuthor)
								: item.name
						}
						optionValue={(item) => item.id}
						placeholder="検索..."
						triggerMode="focus"
						value={(autocompleteItems() || []).find(
							(item) => item.id === props.criterion.value,
						)}
					>
						<ComboboxControl>
							<ComboboxInput />
						</ComboboxControl>
						<ComboboxContent class="max-h-[300px]" />
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
