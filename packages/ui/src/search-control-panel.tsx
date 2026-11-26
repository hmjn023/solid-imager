import { useRenderedSearchState } from "./search-initial-state";
import { t } from "@solid-imager/i18n";
import { getSearchExecutionKind } from "./search-execution";
import type { Author } from "@solid-imager/core/authors";
import type { Character } from "@solid-imager/core/characters";
import type { Ip } from "@solid-imager/core/ips";
import type { Project } from "@solid-imager/core/projects";
import {
	calculateNextModeState,
	type SearchState,
} from "@solid-imager/core/search";
import type { SafeMediaSource } from "@solid-imager/core/sources";
import type { TagResponse } from "@solid-imager/core/tags";
import {
	createSignal,
	ErrorBoundary,
	onCleanup,
	onMount,
	Show,
	Suspense,
} from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { Button } from "./button";
import { EmbeddingSearchControls } from "./embedding-search-controls";
import { Label } from "./label";
import { PresetManager, type PresetManagerClient } from "./preset-manager";
import { ProSearchDialog } from "./pro-search-dialog";
import { SearchFilters } from "./search-filters";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { SortControls } from "./sort-controls";
import {
	clearSimilaritySearch,
	getSearchFiltersRevision,
	searchState,
	setSearchState,
} from "./stores/search-store";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

export type { PresetManagerClient };

export type SearchControlPanelProps = {
	presetClient: PresetManagerClient;
	context: "source" | "global";
	onSearch: () => void;
	filterData: {
		tags: TagResponse[] | undefined;
		projects: Project[] | undefined;
		ips: Ip[] | undefined;
		characters: Character[] | undefined;
		authors: Author[] | undefined;
	};
	sources?: SafeMediaSource[];
	selectedSource?: string;
	onSelectSource?: (id: string) => void;
	/** Optional isolated state for a draft editing surface. */
	state?: SearchState;
	setState?: SetStoreFunction<SearchState>;
	/** Hide inline submit controls when an enclosing surface supplies Apply. */
	showSearchButton?: boolean;
	/** Hide sorting when the workspace toolbar provides it. */
	showSortControls?: boolean;
	class?: string;
	usePopover?: boolean;
	registerSemanticCommit?: (commit: () => boolean) => void;
	registerFilenameCommit?: (commit: (() => void) | undefined) => void;
};

export function SearchControlPanel(props: SearchControlPanelProps) {
	const [presetLoadFailed, setPresetLoadFailed] = createSignal(false);
	const renderedState = useRenderedSearchState();
	const currentState = () => props.state ?? renderedState();
	const updateState = props.setState ?? setSearchState;
	const isOrdinarySearch = () =>
		getSearchExecutionKind(currentState()) === "ordinary";
	const selectedSource = () =>
		props.state?.selectedSource ??
		props.selectedSource ??
		searchState.selectedSource;
	const handleSelectSource = (id: string) => {
		if (props.setState) {
			props.setState("selectedSource", id);
			return;
		}
		props.onSelectSource?.(id);
	};
	const handleSetMode = (mode: "simple" | "pro") => {
		updateState(calculateNextModeState(currentState(), mode));
	};
	const clearSimilarityAnchor = () => {
		if (!props.setState) {
			clearSimilaritySearch();
			return;
		}
		props.setState({
			similarityAnchorMediaId: null,
			semanticQuery: "",
			offset: 0,
			scrollY: 0,
		});
	};

	return (
		<div class={props.class}>
			<div class="flex flex-wrap items-center justify-between gap-2 border-border border-b pb-3">
				<Label class="font-medium text-sm">
					{t("searchControlPanel.searchMode")}
				</Label>
				<ToggleGroup
					aria-label={t("searchControlPanel.searchMode")}
					class="flex-wrap gap-2"
					onChange={(next) => {
						if (next === "simple" || next === "pro") {
							handleSetMode(next);
						}
					}}
					size="sm"
					value={currentState().mode}
					variant="outline"
				>
					<ToggleGroupItem
						class="min-h-11 data-[pressed]:border-primary data-[pressed]:bg-primary data-[pressed]:text-primary-foreground data-[pressed]:hover:bg-primary data-[pressed]:hover:text-primary-foreground md:min-h-9"
						value="simple"
					>
						{t("searchControlPanel.simple")}
					</ToggleGroupItem>
					<ToggleGroupItem
						class="min-h-11 data-[pressed]:border-primary data-[pressed]:bg-primary data-[pressed]:text-primary-foreground data-[pressed]:hover:bg-primary data-[pressed]:hover:text-primary-foreground md:min-h-9"
						value="pro"
					>
						{t("searchControlPanel.advanced")}
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			<Show when={!isOrdinarySearch()}>
				<div class="mt-4 space-y-2">
					<p class="text-sm text-muted-foreground">
						{t(
							"searchControlPanel.ordinarySearchConditionsAreSavedSimilarityAndTextSearches",
						)}
					</p>
					<Button
						class="min-h-11 sm:min-h-9"
						size="sm"
						variant="outline"
						onClick={clearSimilarityAnchor}
					>
						{t("searchControlPanel.returnToOrdinarySearch")}
					</Button>
				</div>
			</Show>

			<Show when={isOrdinarySearch()}>
				<div class="mt-4 flex flex-wrap items-center gap-2">
					<output
						aria-live="polite"
						class="text-sm text-muted-foreground empty:sr-only"
					>
						{presetLoadFailed() ? t("presetManager.couldNotLoadPresets") : ""}
					</output>
					<ErrorBoundary
						fallback={(error, retry) => {
							onMount(() => setPresetLoadFailed(true));
							onCleanup(() => setPresetLoadFailed(false));
							return (
								<Button
									class="min-h-11 sm:min-h-9"
									onClick={retry}
									type="button"
									variant="outline"
								>
									{t("actions.retry")}
								</Button>
							);
						}}
					>
						<Suspense fallback={<p>{t("status.loading")}</p>}>
							<PresetManager
								class="w-full flex-col items-stretch"
								onAction={props.onSearch}
								presetClient={props.presetClient}
								setState={props.setState}
								state={props.state}
							/>
						</Suspense>
					</ErrorBoundary>
				</div>
			</Show>

			<div
				class={
					currentState().mode === "simple" && isOrdinarySearch()
						? "mt-4"
						: "hidden"
				}
			>
				<SearchFilters
					authors={props.filterData.authors}
					characters={props.filterData.characters}
					filenameResetRevision={
						props.state ? undefined : getSearchFiltersRevision()
					}
					ips={props.filterData.ips}
					onSearch={
						props.showSearchButton === false ? undefined : props.onSearch
					}
					projects={props.filterData.projects}
					registerFilenameCommit={props.registerFilenameCommit}
					setState={updateState}
					state={currentState()}
					tags={props.filterData.tags}
					usePopover={props.usePopover}
				/>
			</div>

			<Show when={currentState().mode === "pro" && isOrdinarySearch()}>
				<div class="mt-4 space-y-4">
					<ProSearchDialog
						authors={props.filterData.authors}
						characters={props.filterData.characters}
						ips={props.filterData.ips}
						onChange={(value) => updateState("advancedCondition", value)}
						onSearch={
							props.showSearchButton === false ? undefined : props.onSearch
						}
						projects={props.filterData.projects}
						tags={props.filterData.tags}
						value={currentState().advancedCondition || null}
					/>
				</div>
			</Show>

			<div class="mt-4 space-y-4 border-border border-t pt-4">
				<Show when={props.context === "global" && props.sources}>
					<div class="space-y-2">
						<Label>{t("searchControlPanel.mediaSources")}</Label>
						<Select
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{itemProps.item.rawValue.name}
								</SelectItem>
							)}
							onChange={(value) => {
								const selected = value as { id: string } | undefined;
								handleSelectSource(selected?.id ?? "");
							}}
							options={[
								{ id: "", name: t("labels.allSources") },
								...(props.sources || []),
							]}
							optionValue="id"
							placeholder={t("actions.selectSource")}
							value={[
								{ id: "", name: t("labels.allSources") },
								...(props.sources || []),
							].find((source) => source.id === selectedSource())}
						>
							<SelectTrigger aria-label={t("searchControlPanel.mediaSources")}>
								<SelectValue<{ name: string }>>
									{(state) =>
										state.selectedOption()?.name || t("actions.selectSource")
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</div>
				</Show>
				<EmbeddingSearchControls
					state={currentState()}
					setState={updateState}
					onSearch={props.onSearch}
					id={props.setState ? "mobile-embedding-search" : "embedding-search"}
					registerCommitDraft={props.registerSemanticCommit}
				/>
				<Show when={props.showSortControls !== false}>
					<SortControls
						onClearSimilarity={clearSimilarityAnchor}
						onSimilarityTopKChange={(value) =>
							updateState("similarityTopK", value)
						}
						onSortByChange={(value) => updateState("sortBy", value)}
						onSortOrderChange={(value) => updateState("sortOrder", value)}
						similarityAnchorMediaId={currentState().similarityAnchorMediaId}
						similarityLimitId={
							props.setState
								? "mobile-search-panel-similarity-limit"
								: "search-panel-similarity-limit"
						}
						similarityTopK={currentState().similarityTopK}
						semanticQuery={currentState().semanticQuery}
						sortBy={currentState().sortBy}
						sortOrder={currentState().sortOrder}
					/>
				</Show>
			</div>
		</div>
	);
}
