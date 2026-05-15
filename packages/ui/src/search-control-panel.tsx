import type { Author } from "@solid-imager/core/domain/authors/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { Show } from "solid-js";
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
	searchState,
	setSearchMode,
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
	class?: string;
	usePopover?: boolean;
};

export function SearchControlPanel(props: SearchControlPanelProps) {
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
							props.onSelectSource?.(selected?.id ?? "");
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
						].find((source) => source.id === props.selectedSource)}
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

			<div class="mb-4 flex items-center justify-between">
				<Label class="font-medium text-sm">検索モード</Label>
				<div class="flex gap-2">
					<Button
						onClick={() => setSearchMode("simple")}
						size="sm"
						variant={searchState.mode === "simple" ? "default" : "outline"}
					>
						簡易
					</Button>
					<Button
						onClick={() => setSearchMode("pro")}
						size="sm"
						variant={searchState.mode === "pro" ? "default" : "outline"}
					>
						詳細
					</Button>
				</div>
			</div>

			<SortControls
				className="mb-4"
				onSortByChange={(value) => setSearchState("sortBy", value)}
				onSortOrderChange={(value) => setSearchState("sortOrder", value)}
				sortBy={searchState.sortBy}
				sortOrder={searchState.sortOrder}
			/>

			<div class="my-4 h-px bg-border" />

			<div class={searchState.mode === "simple" ? "block" : "hidden"}>
				<SearchFilters
					authors={props.filterData.authors}
					characters={props.filterData.characters}
					ips={props.filterData.ips}
					onSearch={props.onSearch}
					projects={props.filterData.projects}
					setState={setSearchState}
					state={searchState}
					tags={props.filterData.tags}
					usePopover={props.usePopover}
				/>
			</div>

			<div class={searchState.mode === "pro" ? "block" : "hidden"}>
				<div class="space-y-4">
					<PresetManager
						class="w-full flex-col items-stretch"
						presetClient={props.presetClient}
					/>
					<ProSearchDialog
						authors={props.filterData.authors}
						characters={props.filterData.characters}
						ips={props.filterData.ips}
						onChange={(value) => setSearchState("advancedCondition", value)}
						onSearch={props.onSearch}
						projects={props.filterData.projects}
						tags={props.filterData.tags}
						value={searchState.advancedCondition || null}
					/>
				</div>
			</div>
		</div>
	);
}
