import type { Author } from "@solid-imager/core/domain/authors/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import { calculateNextModeState } from "@solid-imager/core/domain/search/logic";
import type { SearchState } from "@solid-imager/core/domain/search/schema";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { Show } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { Button } from "./button";
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
	type SearchPersistenceSurface,
	searchState,
	setSearchState,
} from "./stores/search-store";

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
	persistenceSurface?: SearchPersistenceSurface;
	class?: string;
	usePopover?: boolean;
};

export function SearchControlPanel(props: SearchControlPanelProps) {
	const currentState = () => props.state ?? searchState;
	const updateState = props.setState ?? setSearchState;
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
			clearSimilaritySearch({ surface: props.persistenceSurface });
			return;
		}
		props.setState({
			similarityAnchorMediaId: null,
			offset: 0,
			scrollY: 0,
		});
	};

	return (
		<div class={props.class}>
			<Show when={props.context === "global" && props.sources}>
				<div class="mb-4 space-y-2">
					<Label>メディアソース</Label>
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
							{ id: "", name: "すべてのソース" },
							...(props.sources || []),
						]}
						optionValue="id"
						placeholder="ソースを選択"
						value={[
							{ id: "", name: "すべてのソース" },
							...(props.sources || []),
						].find((source) => source.id === selectedSource())}
					>
						<SelectTrigger>
							<SelectValue<{ name: string }>>
								{(state) => state.selectedOption()?.name || "ソースを選択"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</div>
			</Show>

			<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
				<Label class="font-medium text-sm">検索モード</Label>
				<div class="flex flex-wrap gap-2">
					<Button
						class="min-h-11 md:min-h-9"
						onClick={() => handleSetMode("simple")}
						size="sm"
						variant={currentState().mode === "simple" ? "default" : "outline"}
					>
						簡易
					</Button>
					<Button
						class="min-h-11 md:min-h-9"
						onClick={() => handleSetMode("pro")}
						size="sm"
						variant={currentState().mode === "pro" ? "default" : "outline"}
					>
						詳細
					</Button>
				</div>
			</div>

			<SortControls
				className="mb-4"
				onClearSimilarity={clearSimilarityAnchor}
				onSimilarityTopKChange={(value) => updateState("similarityTopK", value)}
				onSortByChange={(value) => updateState("sortBy", value)}
				onSortOrderChange={(value) => updateState("sortOrder", value)}
				similarityAnchorMediaId={currentState().similarityAnchorMediaId}
				similarityLimitId={
					props.setState
						? "mobile-search-panel-similarity-limit"
						: "search-panel-similarity-limit"
				}
				similarityTopK={currentState().similarityTopK}
				sortBy={currentState().sortBy}
				sortOrder={currentState().sortOrder}
			/>

			<div class="my-4 h-px bg-border" />

			<div class={currentState().mode === "simple" ? "block" : "hidden"}>
				<SearchFilters
					authors={props.filterData.authors}
					characters={props.filterData.characters}
					ips={props.filterData.ips}
					onSearch={
						props.showSearchButton === false ? undefined : props.onSearch
					}
					projects={props.filterData.projects}
					setState={updateState}
					state={currentState()}
					tags={props.filterData.tags}
					usePopover={props.usePopover}
				/>
			</div>

			<Show when={currentState().mode === "pro"}>
				<div class="space-y-4">
					<PresetManager
						class="w-full flex-col items-stretch"
						presetClient={props.presetClient}
						setState={props.setState}
						state={props.state}
					/>
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
		</div>
	);
}
