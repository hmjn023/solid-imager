import { useRenderedSearchState } from "../search-initial-state";
import { t } from "@solid-imager/i18n";
import {
	getSearchConditionCount,
	getSearchExecutionKind,
} from "../search-execution";
import type { SearchState } from "@solid-imager/core/search";
import type { SafeMediaSource } from "@solid-imager/core/sources";
import ArrowDownUp from "lucide-solid/icons/arrow-down-up";
import ChevronDown from "lucide-solid/icons/chevron-down";
import Filter from "lucide-solid/icons/funnel";
import Grid3X3 from "lucide-solid/icons/grid-3x3";
import List from "lucide-solid/icons/list";
import SquareCheck from "lucide-solid/icons/square-check";
import type { JSX } from "solid-js";
import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	on,
	onCleanup,
	Show,
} from "solid-js";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "../breadcrumb";
import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { ToggleGroup, ToggleGroupItem } from "../toggle-group";
import type { PresetManagerClient } from "../search-control-panel";
import { SearchControlPanel } from "../search-control-panel";
import { createAppShortcut } from "../shortcuts/create-app-shortcut";
import { getSortLabel } from "../sort-options";
import { SortControls } from "../sort-controls";
import type { SourceMediaViewMode } from "../source-media-grid";
import {
	clearPresetFilters,
	getSearchFiltersRevision,
	clearSimilaritySearch,
	searchState,
	setSearchState,
} from "../stores/search-store";
import { CollectionHeader } from "./collection-header";
import { PanelRightClose, PanelRightOpen } from "./icons";
import {
	getSearchComposerTokens,
	parseSimilarityAnchor,
	parseSimilarityTopK,
	type SearchArrayKey,
	SearchComposer,
	type SearchSuggestion,
	type SearchToken,
} from "./search-composer";
import { parseSemanticSearchDraft } from "./search-composer-utils";

export type SearchToolbarProps = {
	actions?: JSX.Element;
	bulkSelection?: {
		active: boolean;
		onEnter: () => void;
		onClear?: () => void;
	};
	context: "global" | "source";
	filterData: {
		authors: import("@solid-imager/core/authors").Author[] | undefined;
		characters: import("@solid-imager/core/characters").Character[] | undefined;
		ips: import("@solid-imager/core/ips").Ip[] | undefined;
		projects: import("@solid-imager/core/projects").Project[] | undefined;
		tags: import("@solid-imager/core/tags").TagResponse[] | undefined;
	};
	itemCount?: number;
	isUpdating?: boolean;
	inspectorToggle?: {
		isOpen: boolean;
		onToggle: () => void;
	};
	onSearch: () => void;
	onSelectSource?: (id: string) => void;
	presetClient: PresetManagerClient;
	selectedSource?: string;
	sourceName: string;
	sources?: SafeMediaSource[];
	updatingLabel?: string;
	viewMode?: SourceMediaViewMode;
	onViewModeChange?: (mode: SourceMediaViewMode) => void;
};

function parseValues(value: string): string[] {
	return [
		...new Set(
			value
				.split(",")
				.map((part) => part.trim())
				.filter(Boolean),
		),
	];
}

function appendValues(key: SearchArrayKey, rawValue: string) {
	const values = parseValues(rawValue);
	if (values.length === 0) return;
	setSearchState(key, [...new Set([...searchState[key], ...values])]);
}

function removeToken(token: SearchToken) {
	if (token.key === "semanticQuery") {
		setSearchState("semanticQuery", "");
		return;
	}
	if (token.key === "searchQuery") {
		setSearchState("searchQuery", "");
		return;
	}
	if (token.key === "similarityAnchorMediaId") {
		clearSimilaritySearch();
		return;
	}
	if (token.key === "similarityTopK") {
		return;
	}
	setSearchState(
		token.key,
		searchState[token.key].filter((value) => value !== token.value),
	);
}

const SEARCH_APPLY_DEBOUNCE_MS = 250;

function tokenId(token: Pick<SearchToken, "key" | "value">): string {
	return `${token.key}\u0000${token.value}`;
}

function submitComposerDraft(rawDraft: string): boolean {
	const semanticDraft = parseSemanticSearchDraft(rawDraft);
	if (semanticDraft !== undefined) {
		if (!semanticDraft) return false;
		setSearchState({
			semanticQuery: semanticDraft,
			similarityAnchorMediaId: null,
			similarityModel: "embeddinggemma2",
			offset: 0,
			scrollY: 0,
		});
		return true;
	}
	const parts = rawDraft.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
	const freeText: string[] = [];
	let changed = false;
	let matchedOrdinaryCondition = false;
	let sawSimilarityAnchor = false;

	for (const part of parts) {
		const separatorIndex = part.indexOf(":");
		if (separatorIndex < 1) {
			freeText.push(part.replace(/^"|"$/g, ""));
			continue;
		}
		const prefix = part.slice(0, separatorIndex).toLowerCase();
		const value = part
			.slice(separatorIndex + 1)
			.replace(/^"|"$/g, "")
			.trim();
		if (!value) continue;

		switch (prefix) {
			case "similar": {
				const anchorMediaId = parseSimilarityAnchor(value);
				if (!anchorMediaId) {
					freeText.push(part);
					break;
				}
				sawSimilarityAnchor = true;
				if (searchState.similarityAnchorMediaId !== anchorMediaId) {
					setSearchState("similarityAnchorMediaId", anchorMediaId);
					changed = true;
				}
				if (searchState.semanticQuery) {
					setSearchState("semanticQuery", "");
					changed = true;
				}
				break;
			}
			case "name":
				setSearchState("searchQuery", value);
				matchedOrdinaryCondition = true;
				changed = true;
				break;
			case "tag":
				appendValues("selectedTags", value);
				matchedOrdinaryCondition = true;
				changed = true;
				break;
			case "-tag":
				appendValues("excludeTags", value);
				matchedOrdinaryCondition = true;
				changed = true;
				break;
			case "character":
				appendValues("selectedCharacters", value);
				matchedOrdinaryCondition = true;
				changed = true;
				break;
			case "ip":
				appendValues("selectedIps", value);
				matchedOrdinaryCondition = true;
				changed = true;
				break;
			case "author":
				appendValues("selectedAuthors", value);
				matchedOrdinaryCondition = true;
				changed = true;
				break;
			case "project":
				appendValues("selectedProjects", value);
				matchedOrdinaryCondition = true;
				changed = true;
				break;
			case "limit": {
				const topK = parseSimilarityTopK(value);
				if (searchState.similarityAnchorMediaId && topK !== undefined) {
					if (searchState.similarityTopK !== topK) {
						setSearchState("similarityTopK", topK);
						changed = true;
					}
				} else {
					freeText.push(part);
				}
				break;
			}
			default:
				freeText.push(part);
		}
	}

	if (freeText.length > 0) {
		setSearchState("searchQuery", freeText.join(" "));
		matchedOrdinaryCondition = true;
		changed = true;
	}

	if (matchedOrdinaryCondition) {
		if (searchState.mode === "pro") {
			setSearchState("mode", "simple");
			changed = true;
		}
		if (searchState.semanticQuery) {
			setSearchState("semanticQuery", "");
			changed = true;
		}
		if (!sawSimilarityAnchor && searchState.similarityAnchorMediaId) {
			setSearchState("similarityAnchorMediaId", null);
			changed = true;
		}
	}
	return changed;
}

function sortLabel(state: SearchState): string {
	if (getSearchExecutionKind(state) === "semantic")
		return t("searchToolbar.textSearchValueResults", {
			value0: String(state.similarityTopK),
		});
	if (getSearchExecutionKind(state) === "similarity") {
		return t("searchToolbar.similarityValueResults", {
			value0: String(state.similarityTopK),
		});
	}
	const field = getSortLabel(state.sortBy);
	return t("searchToolbar.valueValue", {
		value0: String(field),
		value1: String(
			state.sortOrder === "desc"
				? t("searchToolbar.descending")
				: t("searchToolbar.ascending"),
		),
	});
}

export function SearchToolbar(props: SearchToolbarProps) {
	const state = useRenderedSearchState();
	const [draft, setDraft] = createSignal("");
	const [pendingSuggestions, setPendingSuggestions] = createSignal<
		SearchSuggestion[]
	>([]);
	const [pendingRemovals, setPendingRemovals] = createSignal<SearchToken[]>([]);
	const [filterOpen, setFilterOpen] = createSignal(false);
	const [sortOpen, setSortOpen] = createSignal(false);
	let commitSemanticDraft: (() => boolean) | undefined;
	const tokens = createMemo(() => {
		const removalIds = new Set(pendingRemovals().map(tokenId));
		return [
			...getSearchComposerTokens(state()).filter(
				(token) => !removalIds.has(tokenId(token)),
			),
			...pendingSuggestions().map((suggestion) => ({
				key: suggestion.key,
				prefix: suggestion.prefix,
				value: suggestion.value,
			})),
		];
	});
	const appliedFilterCount = createMemo(() =>
		getSearchExecutionKind(state()) === "ordinary"
			? getSearchConditionCount(state())
			: 0,
	);
	let composerInput: HTMLInputElement | undefined;
	let searchApplyTimer: ReturnType<typeof setTimeout> | undefined;
	const applySuggestionAdditions = (additions: SearchSuggestion[]) => {
		if (additions.length === 0) return;
		if (state().mode === "pro") {
			setSearchState("mode", "simple");
		}
		if (state().semanticQuery) {
			setSearchState("semanticQuery", "");
		}
		if (state().similarityAnchorMediaId) {
			setSearchState("similarityAnchorMediaId", null);
		}
		for (const suggestion of additions) {
			setSearchState(suggestion.key, [
				...new Set([...state()[suggestion.key], suggestion.value]),
			]);
		}
	};
	const applyPendingChanges = () => {
		searchApplyTimer = undefined;
		const additions = pendingSuggestions();
		const removals = pendingRemovals();
		if (additions.length === 0 && removals.length === 0) return;

		batch(() => {
			for (const token of removals) removeToken(token);
			applySuggestionAdditions(additions);
		});
		setPendingSuggestions([]);
		setPendingRemovals([]);
		props.onSearch();
	};
	const scheduleSearchApply = () => {
		if (searchApplyTimer) clearTimeout(searchApplyTimer);
		searchApplyTimer = setTimeout(
			applyPendingChanges,
			SEARCH_APPLY_DEBOUNCE_MS,
		);
	};
	onCleanup(() => {
		if (searchApplyTimer) clearTimeout(searchApplyTimer);
	});
	createEffect(
		on(
			getSearchFiltersRevision,
			() => {
				clearTimeout(searchApplyTimer);
				searchApplyTimer = undefined;
				setPendingSuggestions([]);
				setPendingRemovals([]);
			},
			{ defer: true },
		),
	);
	const selectSuggestion = (suggestion: SearchSuggestion) => {
		const suggestionId = tokenId(suggestion);
		if (pendingRemovals().some((token) => tokenId(token) === suggestionId)) {
			setPendingRemovals((current) =>
				current.filter((token) => tokenId(token) !== suggestionId),
			);
			scheduleSearchApply();
			return;
		}
		setPendingSuggestions((current) =>
			current.some(
				(item) =>
					item.key === suggestion.key && item.value === suggestion.value,
			)
				? current
				: [...current, suggestion],
		);
		scheduleSearchApply();
	};
	const submitDraft = () => {
		if (searchApplyTimer) clearTimeout(searchApplyTimer);
		searchApplyTimer = undefined;
		const additions = pendingSuggestions();
		const removals = pendingRemovals();
		let changed = additions.length > 0 || removals.length > 0;
		batch(() => {
			for (const token of removals) removeToken(token);
			applySuggestionAdditions(additions);
			if (submitComposerDraft(draft())) changed = true;
		});
		if (!changed) return;
		setPendingSuggestions([]);
		setPendingRemovals([]);
		setDraft("");
		props.onSearch();
	};

	createAppShortcut("focusSearch", () => composerInput?.focus());
	createAppShortcut(
		"viewGrid",
		() => props.onViewModeChange?.("grid"),
		() => ({ enabled: props.onViewModeChange !== undefined }),
	);
	createAppShortcut(
		"viewList",
		() => props.onViewModeChange?.("list"),
		() => ({ enabled: props.onViewModeChange !== undefined }),
	);

	return (
		<CollectionHeader
			heading={
				<Breadcrumb class="min-w-0">
					<BreadcrumbList class="min-w-0 flex-nowrap gap-2 sm:gap-2">
						<BreadcrumbItem class="shrink-0">
							<span class="cursor-default">{t("navigation.library")}</span>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem class="min-w-0">
							<span
								aria-current="page"
								class="min-w-0 truncate font-semibold text-foreground"
							>
								{props.sourceName}
							</span>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			}
			summary={
				<>
					<Show when={props.isUpdating}>
						<output
							class="ml-auto flex min-w-0 max-w-56 shrink-0 items-center gap-2 truncate text-xs text-muted-foreground"
							data-state-ui="background-fetching"
						>
							<span
								aria-hidden="true"
								class="size-2 shrink-0 rounded-full bg-current motion-safe:animate-pulse"
							/>
							<span class="truncate">
								{props.updatingLabel ?? t("searchToolbar.updating")}
							</span>
						</output>
					</Show>
					<Show when={!props.isUpdating && props.itemCount !== undefined}>
						<span class="ml-auto shrink-0 text-xs text-muted-foreground">
							{t("charts.valueItems", {
								value0: String(props.itemCount?.toLocaleString()),
							})}
						</span>
					</Show>
				</>
			}
		>
			<Show when={getSearchExecutionKind(state()) !== "ordinary"}>
				<output class="mb-2 block text-xs text-muted-foreground">
					{t("searchToolbar.filtersAndSortingForOrdinarySearchAreSavedThey")}
				</output>
			</Show>
			<Show
				when={
					getSearchExecutionKind(state()) === "ordinary" &&
					state().mode === "pro" &&
					state().advancedCondition
				}
			>
				<p class="mb-2 text-xs text-muted-foreground">
					{t(
						"searchToolbar.advancedConditionsAreActiveOpenFiltersToReviewThem",
					)}
				</p>
			</Show>
			<div class="flex min-w-0 flex-wrap items-start gap-2">
				<SearchComposer
					draft={draft()}
					filterData={props.filterData}
					onDraftChange={(value) => setDraft(value)}
					onRemoveToken={(token) => {
						if (token.removable === false) return;
						const id = tokenId(token);
						const pending = pendingSuggestions();
						if (pending.some((item) => tokenId(item) === id)) {
							setPendingSuggestions((current) =>
								current.filter((item) => tokenId(item) !== id),
							);
							scheduleSearchApply();
							return;
						}
						setPendingRemovals((current) =>
							current.some((item) => tokenId(item) === id)
								? current
								: [...current, token],
						);
						scheduleSearchApply();
					}}
					onSelectSuggestion={selectSuggestion}
					onSubmit={submitDraft}
					inputRef={(element) => {
						composerInput = element;
					}}
					tokens={tokens()}
				/>

				<Popover
					onOpenChange={(open) => {
						if (!open && commitSemanticDraft?.()) {
							props.onSearch();
						}
						setFilterOpen(open);
					}}
					open={filterOpen()}
					placement="bottom-end"
				>
					<PopoverTrigger
						aria-label={t("searchToolbar.searchFiltersValueConditions", {
							value0: String(appliedFilterCount()),
						})}
						as={Button}
						class="min-h-11 border-input bg-card px-3 shadow-none sm:min-h-9"
						size="sm"
						variant="outline"
					>
						<Filter aria-hidden="true" size={15} />
						{t("searchToolbar.filters")}
						<Show when={appliedFilterCount() > 0}>
							<span class="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-label-xs text-primary-foreground">
								{appliedFilterCount()}
							</span>
						</Show>
					</PopoverTrigger>
					<PopoverContent
						aria-label={t("searchToolbar.searchFilters")}
						class="workspace-theme relative flex min-h-0 max-h-popover-fit-available w-popover-compact! flex-col overflow-hidden bg-card p-0 text-foreground shadow-xl data-[closed]:hidden data-[expanded]:animate-none"
					>
						<div class="flex shrink-0 items-start justify-between border-border border-b px-4 py-3">
							<div>
								<h2 class="font-semibold text-sm">
									{t("searchToolbar.searchFilters")}
								</h2>
								<p class="mt-0.5 text-label-sm text-muted-foreground">
									{t("searchToolbar.editTheSameConditionsAsTheSearchBar")}
								</p>
							</div>
							<Button
								class="min-h-11 px-2 text-xs sm:h-7 sm:min-h-7"
								onClick={() => {
									clearPresetFilters();
									props.onSearch();
								}}
								size="sm"
								variant="ghost"
							>
								{t("searchToolbar.clearAll")}
							</Button>
						</div>
						<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
							<SearchControlPanel
								context={props.context}
								filterData={props.filterData}
								onSearch={() => {
									setFilterOpen(false);
									props.onSearch();
								}}
								onSelectSource={props.onSelectSource}
								presetClient={props.presetClient}
								registerSemanticCommit={(commit) => {
									commitSemanticDraft = commit;
								}}
								selectedSource={props.selectedSource}
								showSearchButton={false}
								showSortControls={false}
								sources={props.sources}
								usePopover={false}
							/>
						</div>
						<div class="flex shrink-0 justify-end gap-2 border-border border-t bg-card p-3">
							<Button
								class="min-h-11 sm:min-h-9"
								onClick={() => {
									if (commitSemanticDraft?.()) {
										props.onSearch();
									}
									setFilterOpen(false);
								}}
								size="sm"
								variant="outline"
							>
								{t("actions.close")}
							</Button>
						</div>
					</PopoverContent>
				</Popover>

				<Popover
					onOpenChange={setSortOpen}
					open={sortOpen()}
					placement="bottom-end"
				>
					<PopoverTrigger
						aria-label={t("searchToolbar.sortCurrentlyValue", {
							value0: String(sortLabel(state())),
						})}
						as={Button}
						class="min-h-11 border-input bg-card px-3 shadow-none sm:min-h-9 sm:w-56 sm:justify-between"
						size="sm"
						variant="outline"
					>
						<ArrowDownUp aria-hidden="true" size={15} />
						<span class="hidden min-w-0 flex-1 truncate text-left sm:inline">
							{sortLabel(state())}
						</span>
						<ChevronDown aria-hidden="true" size={13} />
					</PopoverTrigger>
					<PopoverContent class="workspace-theme w-72 p-4 shadow-xl">
						<SortControls
							onClearSimilarity={() => clearSimilaritySearch()}
							onSortByChange={(value) => setSearchState("sortBy", value)}
							onSortOrderChange={(value) => setSearchState("sortOrder", value)}
							onSimilarityTopKChange={(value) =>
								setSearchState("similarityTopK", value)
							}
							similarityAnchorMediaId={state().similarityAnchorMediaId}
							similarityLimitId="sort-similarity-limit"
							similarityTopK={state().similarityTopK}
							semanticQuery={state().semanticQuery}
							sortBy={state().sortBy}
							sortOrder={state().sortOrder}
						/>
					</PopoverContent>
				</Popover>
				<ToggleGroup
					class="gap-0 rounded-md border border-input bg-card p-0.5"
					onChange={(next) => {
						if (next === "grid" || next === "list") {
							props.onViewModeChange?.(next);
						}
					}}
					value={props.viewMode ?? "grid"}
				>
					<ToggleGroupItem
						aria-label={t("actions.gridView")}
						class="size-11 p-0 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground data-[pressed]:hover:bg-primary data-[pressed]:hover:text-primary-foreground sm:size-8"
						value="grid"
					>
						<Grid3X3 aria-hidden="true" size={15} />
					</ToggleGroupItem>
					<ToggleGroupItem
						aria-label={t("actions.listView")}
						class="size-11 p-0 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground data-[pressed]:hover:bg-primary data-[pressed]:hover:text-primary-foreground sm:size-8"
						value="list"
					>
						<List aria-hidden="true" size={15} />
					</ToggleGroupItem>
				</ToggleGroup>
				<Show when={props.bulkSelection}>
					{(selection) => (
						<Button
							aria-pressed={selection().active}
							class="min-h-11 sm:min-h-9"
							onClick={() => {
								if (selection().active) selection().onClear?.();
								else selection().onEnter();
							}}
							size="sm"
							variant={selection().active ? "secondary" : "outline"}
						>
							<SquareCheck aria-hidden="true" size={15} />
							{t("sourceMediaScreen.selectMultiple")}
						</Button>
					)}
				</Show>
				<Show when={props.inspectorToggle}>
					{(toggle) => (
						<Button
							aria-label={
								toggle().isOpen
									? t("collectionInspector.hideInspector")
									: t("collectionInspector.showInspector")
							}
							aria-pressed={toggle().isOpen}
							class="hidden min-h-9 2xl:inline-flex"
							onClick={() => toggle().onToggle()}
							size="sm"
							type="button"
							variant={toggle().isOpen ? "secondary" : "outline"}
						>
							<Show
								fallback={<PanelRightOpen aria-hidden="true" size={15} />}
								when={toggle().isOpen}
							>
								<PanelRightClose aria-hidden="true" size={15} />
							</Show>
							{t("collectionInspector.inspector")}
						</Button>
					)}
				</Show>
				{props.actions}
			</div>
		</CollectionHeader>
	);
}
