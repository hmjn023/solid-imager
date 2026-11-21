import { t } from "@solid-imager/i18n";
import type { Author } from "@solid-imager/core/authors";
import type { Character } from "@solid-imager/core/characters";
import type { Ip } from "@solid-imager/core/ips";
import type { SearchCriterion, SearchGroup } from "@solid-imager/core/search";
import type { Project } from "@solid-imager/core/projects";
import type { TagResponse } from "@solid-imager/core/tags";
import {
	createEffect,
	createMemo,
	createSignal,
	Index,
	Match,
	Show,
	Switch,
} from "solid-js";
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
import { createDebouncedSignal } from "./utils/debounce";
import { parseSelectValue } from "./utils/parse-select-value";

const TARGET_LABELS: Record<string, string> = {
	fileName: t("uploadMediaModal.filename"),
	filePath: t("proSearchBuilder.filePath"),
	description: t("labels.description"),
	keyword: t("proSearchBuilder.keywords"),
	tag: t("pixivArtworkDetail.tags"),
	author: t("labels.authors"),
	project: t("labels.projects"),
	ip: t("labels.ips"),
	character: t("labels.characters"),
	folder: t("proSearchBuilder.folder"),
	favorite: t("proSearchBuilder.favorites"),
	rating: t("sortOptions.rating"),
	viewCount: t("sortOptions.viewCount"),
	fileSize: t("sortOptions.fileSize"),
	createdAt: t("collectionInspector.created"),
	aiGenerated: t("proSearchBuilder.aIGenerated"),
};

const OPERATOR_LABELS: Record<string, string> = {
	equals: t("proSearchBuilder.equals"),
	contains: t("proSearchBuilder.contains"),
	startsWith: t("proSearchBuilder.startsWith"),
	endsWith: t("proSearchBuilder.endsWith"),
	gt: t("proSearchBuilder.greaterThan"),
	gte: t("proSearchBuilder.atLeast"),
	lt: t("proSearchBuilder.lessThan"),
	lte: t("proSearchBuilder.atMost"),
	in: t("proSearchBuilder.isAnyOf"),
	notIn: t("proSearchBuilder.isNoneOf"),
	isEmpty: t("proSearchBuilder.isEmpty"),
	isNotEmpty: t("proSearchBuilder.isNotEmpty"),
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
const NUMERIC_TARGETS = new Set([
	"rating",
	"viewCount",
	"fileSize",
	"width",
	"height",
]);
const BOOLEAN_TARGETS = new Set(["aiGenerated", "favorite", "isArchived"]);

function isListOperator(operator: string): boolean {
	return operator === "in" || operator === "notIn";
}

function isEmptyOperator(operator: string): boolean {
	return operator === "isEmpty" || operator === "isNotEmpty";
}

function parseCommaList(raw: string): string[] {
	return raw
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function areListValuesEqual(
	a: readonly string[],
	b: SearchCriterion["value"],
): boolean {
	if (!Array.isArray(b)) {
		return a.length === 0 && (b === null || b === "");
	}
	return (
		a.length === b.length &&
		a.every((value, index) => value === String(b[index]))
	);
}

function formatListDraft(value: SearchCriterion["value"]): string {
	return Array.isArray(value) ? value.map(String).join(", ") : "";
}

function formatDateInputValue(value: SearchCriterion["value"]): string {
	if (typeof value !== "string") return "";
	if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
		return value.slice(0, 10);
	}
	return value;
}

function normalizeValueForOperator(
	target: string,
	nextOperator: SearchCriterion["operator"],
	currentValue: SearchCriterion["value"],
): SearchCriterion["value"] {
	if (BOOLEAN_TARGETS.has(target)) {
		return Boolean(currentValue);
	}
	if (isEmptyOperator(nextOperator)) {
		return null;
	}
	if (isListOperator(nextOperator)) {
		if (Array.isArray(currentValue)) {
			return currentValue;
		}
		if (currentValue === null || currentValue === "") {
			return [];
		}
		return [String(currentValue)];
	}
	if (Array.isArray(currentValue)) {
		if (NUMERIC_TARGETS.has(target)) {
			const first = Number(currentValue[0]);
			return Number.isFinite(first) ? first : null;
		}
		return currentValue[0] !== undefined ? String(currentValue[0]) : "";
	}
	if (NUMERIC_TARGETS.has(target)) {
		return typeof currentValue === "number" && Number.isFinite(currentValue)
			? currentValue
			: null;
	}
	return currentValue === null ? "" : currentValue;
}

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

function getSearchGroup(child: SearchCriterion | SearchGroup): SearchGroup {
	if (child.type === "group") {
		return child;
	}
	throw new Error(t("proSearchBuilder.expectedASearchGroup"));
}

function getSearchCriterion(
	child: SearchCriterion | SearchGroup,
): SearchCriterion {
	if (child.type === "criterion") {
		return child;
	}
	throw new Error(t("proSearchBuilder.expectedASearchCriterion"));
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
				props.depth % 2 === 0
					? "border-l-info-foreground"
					: "border-l-success-foreground",
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
							<SelectTrigger
								aria-label={t("proSearchBuilder.groupOperator")}
								class="w-20 sm:w-24"
							>
								<SelectValue<string>>
									{(state) => state.selectedOption().toUpperCase()}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
						<span class="text-muted-foreground text-sm">
							{t("proSearchBuilder.conditionGroup")}
						</span>
					</div>

					<div class="flex w-full flex-col gap-2">
						<div class="flex flex-wrap gap-2">
							<Button
								class="flex-1 whitespace-nowrap"
								onClick={() => addChild("criterion")}
								size="sm"
								variant="outline"
							>
								{t("proSearchBuilder.condition")}
							</Button>
							<Button
								class="flex-1 whitespace-nowrap"
								onClick={() => addChild("group")}
								size="sm"
								variant="outline"
							>
								{t("proSearchBuilder.group")}
							</Button>
						</div>
						<Show when={!props.isRoot}>
							<Button
								class="w-full text-destructive"
								onClick={props.onRemove}
								size="sm"
								variant="ghost"
							>
								{t("actions.delete")}
							</Button>
						</Show>
					</div>
				</div>

				<div class="space-y-2 border-border border-l pl-2 sm:pl-4">
					<Index each={props.group.children}>
						{(child, index) =>
							child().type === "group" ? (
								<GroupBuilder
									authors={props.authors}
									characters={props.characters}
									depth={props.depth + 1}
									group={getSearchGroup(child())}
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
									criterion={getSearchCriterion(child())}
									ips={props.ips}
									onChange={(value) => updateChild(index, value)}
									onRemove={() => removeChild(index)}
									projects={props.projects}
									tags={props.tags}
								/>
							)
						}
					</Index>
					<Show when={props.group.children.length === 0}>
						<div class="p-2 text-muted-foreground text-sm italic">
							{t("proSearchBuilder.noConditionsUseConditionToAddOne")}
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
		author.accountId ? `${author.name}：${author.accountId}` : author.name;

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
	const [filterText, setFilterText] = createDebouncedSignal("", 150);
	const filteredItems = createMemo(() => {
		const items = autocompleteItems();
		if (!items) return [];
		const query = filterText().toLowerCase();
		if (!query) return items.slice(0, 100);
		return items
			.filter((item) => {
				if (!item) return false;
				const label = "accountId" in item ? getAuthorLabel(item) : item.name;
				return label.toLowerCase().includes(query);
			})
			.slice(0, 100);
	});

	const isNumericTarget = createMemo(() =>
		NUMERIC_TARGETS.has(props.criterion.target),
	);
	const isDateTarget = createMemo(() => props.criterion.target === "createdAt");
	const isBooleanTarget = createMemo(() =>
		BOOLEAN_TARGETS.has(props.criterion.target),
	);
	const targetLabel = () =>
		TARGET_LABELS[props.criterion.target] ?? t("proSearchBuilder.value");
	const [listDraft, setListDraft] = createSignal(
		formatListDraft(props.criterion.value),
	);
	createEffect(() => {
		const value = props.criterion.value;
		if (!isListOperator(props.criterion.operator)) {
			setListDraft("");
			return;
		}
		if (!areListValuesEqual(parseCommaList(listDraft()), value)) {
			setListDraft(formatListDraft(value));
		}
	});
	const ALL_OPERATORS = [
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
	] as const satisfies readonly SearchCriterion["operator"][];

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
					const nextTarget = parseSelectValue(
						value,
						Object.keys(TARGET_LABELS) as readonly SearchCriterion["target"][],
						"fileName",
					);
					const nextOperator = parseSelectValue(
						operators[0] || "equals",
						ALL_OPERATORS,
						"equals",
					);
					props.onChange({
						...props.criterion,
						target: nextTarget,
						operator: nextOperator,
						value: BOOLEAN_TARGETS.has(nextTarget)
							? true
							: isEmptyOperator(nextOperator) || NUMERIC_TARGETS.has(nextTarget)
								? null
								: isListOperator(nextOperator)
									? []
									: "",
					});
				}}
				options={Object.keys(TARGET_LABELS)}
				value={props.criterion.target}
			>
				<SelectTrigger
					aria-label={t("proSearchBuilder.targetField")}
					class="w-full"
				>
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
						const nextOperator = parseSelectValue(
							value,
							ALL_OPERATORS,
							"equals",
						);
						props.onChange({
							...props.criterion,
							operator: nextOperator,
							value: normalizeValueForOperator(
								props.criterion.target,
								nextOperator,
								props.criterion.value,
							),
						});
					}
				}}
				options={getValidOperators(props.criterion.target)}
				value={props.criterion.operator}
			>
				<SelectTrigger
					aria-label={t("proSearchBuilder.operator")}
					class="w-full"
				>
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
						onInputChange={(text) => setFilterText(text)}
						optionLabel={(item) =>
							item
								? "accountId" in item
									? getAuthorLabel(item)
									: item.name
								: ""
						}
						options={filteredItems()}
						optionTextValue={(item) =>
							item
								? "accountId" in item
									? getAuthorLabel(item)
									: item.name
								: ""
						}
						optionValue={(item) => item.id}
						placeholder={t("proSearchBuilder.search")}
						triggerMode="focus"
						value={(autocompleteItems() || []).find(
							(item) => item.name === props.criterion.value,
						)}
					>
						<ComboboxControl>
							<ComboboxInput aria-label={targetLabel()} />
						</ComboboxControl>
						<VirtualComboboxContent class="max-h-72" />
					</Combobox>
				</Match>

				<Match when={isBooleanTarget()}>
					<Select
						itemComponent={(itemProps) => (
							<SelectItem item={itemProps.item}>
								{itemProps.item.rawValue === "true"
									? t("proSearchBuilder.true")
									: t("proSearchBuilder.false")}
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
						<SelectTrigger aria-label={targetLabel()} class="w-full">
							<SelectValue<string>>
								{(state) =>
									state.selectedOption() === "true"
										? t("proSearchBuilder.true")
										: t("proSearchBuilder.false")
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</Match>

				<Match when={isListOperator(props.criterion.operator)}>
					<div class="space-y-1">
						<Input
							aria-label={targetLabel()}
							class="w-full"
							onBlur={() =>
								setListDraft(formatListDraft(props.criterion.value))
							}
							onInput={(event) => {
								const raw = event.currentTarget.value;
								setListDraft(raw);
								props.onChange({
									...props.criterion,
									value: parseCommaList(raw),
								});
							}}
							placeholder={t("proSearchBuilder.enterCommaSeparatedValues")}
							value={listDraft()}
						/>
						<p class="text-muted-foreground text-xs">
							{t("proSearchBuilder.enterMultipleValuesSeparatedByCommas")}
						</p>
					</div>
				</Match>

				<Match when={isEmptyOperator(props.criterion.operator)}>
					<div class="rounded-md border border-dashed p-2 text-center text-muted-foreground text-xs italic">
						{t("proSearchBuilder.thisConditionNeedsNoValue")}
					</div>
				</Match>

				<Match when={true}>
					<Input
						aria-label={targetLabel()}
						class="w-full"
						onInput={(event) => {
							const raw = event.currentTarget.value;
							if (isNumericTarget()) {
								if (raw.trim() === "") {
									props.onChange({ ...props.criterion, value: null });
									return;
								}
								const parsed = Number(raw);
								if (Number.isFinite(parsed)) {
									props.onChange({ ...props.criterion, value: parsed });
								}
								return;
							}
							props.onChange({ ...props.criterion, value: raw });
						}}
						placeholder={t("proSearchBuilder.value")}
						type={
							isNumericTarget() ? "number" : isDateTarget() ? "date" : "text"
						}
						value={
							isDateTarget()
								? formatDateInputValue(props.criterion.value)
								: Array.isArray(props.criterion.value)
									? props.criterion.value.join(", ")
									: String(props.criterion.value ?? "")
						}
					/>
				</Match>
			</Switch>

			<Button
				class="w-full text-destructive"
				onClick={props.onRemove}
				variant="ghost"
			>
				{t("actions.delete")}
			</Button>
		</div>
	);
}
