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
					<Button
						onClick={() => setSearchMode("vector")}
						size="sm"
						variant={searchState.mode === "vector" ? "default" : "outline"}
					>
						ベクトル類似
					</Button>
				</div>
			</div>

			<Show when={searchState.mode !== "vector"}>
				<SortControls
					className="mb-4"
					onSortByChange={(value) => setSearchState("sortBy", value)}
					onSortOrderChange={(value) => setSearchState("sortOrder", value)}
					sortBy={searchState.sortBy}
					sortOrder={searchState.sortOrder}
				/>
			</Show>

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

			<div class={searchState.mode === "vector" ? "block" : "hidden"}>
				<div class="space-y-4">
					<div class="space-y-2">
						<Label>類似元メディア</Label>
						<div class="rounded-md border p-3 text-sm">
							{searchState.similarityAnchorMediaId ??
								"メディア個別画面の「Find Similar」から選択してください。"}
						</div>
					</div>
					<div class="space-y-2">
						<Label>表示件数</Label>
						<div class="flex gap-2">
							{([20, 50, 100] as const).map((value) => (
								<Button
									onClick={() => setSearchState("similarityTopK", value)}
									size="sm"
									variant={
										searchState.similarityTopK === value ? "default" : "outline"
									}
								>
									{value}
								</Button>
							))}
						</div>
					</div>
					<Button
						disabled={!searchState.similarityAnchorMediaId}
						onClick={props.onSearch}
					>
						類似メディアを検索
					</Button>
					<p class="text-muted-foreground text-xs">
						CCIPによるキャラクター類似検索です。一般的な画像重複検索とは異なります。
					</p>
				</div>
			</div>
		</div>
	);
}
