import { Button } from "@solid-imager/ui/button";
import { Label } from "@solid-imager/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@solid-imager/ui/select";
import {
	Switch,
	SwitchControl,
	SwitchLabel,
	SwitchThumb,
} from "@solid-imager/ui/switch";
import { Show } from "solid-js";
import { reconcile, type SetStoreFunction } from "solid-js/store";
import type { MockSource } from "../../mocks/demo-data";
import { PresetManager } from "./preset-manager";
import { ProSearchDialog } from "./pro-search-dialog";
import {
	SearchFilters,
	type TauriSearchFilterData,
	type TauriSearchFilterState,
} from "./search-filters";
import { SortControls, type TauriSortOption } from "./sort-controls";

export type TauriSearchMode = "simple" | "pro";
export type TauriSortBy = TauriSortOption;
export type TauriSortOrder = "asc" | "desc";

type SearchControlPanelProps = {
	context: "source" | "global";
	filterData: TauriSearchFilterData;
	mode: TauriSearchMode;
	onModeChange: (mode: TauriSearchMode) => void;
	onSearch: () => void;
	onSelectSource?: (id: string) => void;
	onAdvancedQueryChange: (value: string) => void;
	selectedSource?: string;
	setState: SetStoreFunction<TauriSearchFilterState>;
	state: TauriSearchFilterState;
	sources?: MockSource[];
	advancedQuery: string;
	class?: string;
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
						onChange={(value) => props.onSelectSource?.(value?.id ?? "")}
						options={[
							{ id: "", name: "すべてのソース" },
							...(props.sources ?? []).map((source) => ({
								id: source.id,
								name: source.name,
							})),
						]}
						optionValue="id"
						placeholder="ソースを選択"
						value={[
							{ id: "", name: "すべてのソース" },
							...(props.sources ?? []).map((source) => ({
								id: source.id,
								name: source.name,
							})),
						].find((source) => source.id === (props.selectedSource ?? ""))}
					>
						<SelectTrigger>
							<SelectValue>
								{(state) =>
									(state.selectedOption() as { name?: string } | undefined)
										?.name ?? "ソースを選択"
								}
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
						onClick={() => props.onModeChange("simple")}
						size="sm"
						variant={props.mode === "simple" ? "default" : "outline"}
					>
						簡易
					</Button>
					<Button
						onClick={() => props.onModeChange("pro")}
						size="sm"
						variant={props.mode === "pro" ? "default" : "outline"}
					>
						詳細
					</Button>
				</div>
			</div>

			<SortControls
				className="mb-4"
				onSortByChange={(value) => props.setState("sortBy", value)}
				onSortOrderChange={(value) => props.setState("sortOrder", value)}
				sortBy={props.state.sortBy}
				sortOrder={props.state.sortOrder}
			/>

			<div class="my-4 h-px bg-border" />

			<Show when={props.mode === "simple"}>
				<div class="space-y-4">
					<div class="space-y-2">
						<Label>ステータス</Label>
						<div class="flex flex-wrap gap-2">
							{(["queued", "review", "tagged"] as const).map((status) => (
								<Button
									onClick={() =>
										props.setState(
											"selectedStatus",
											props.state.selectedStatus === status ? null : status,
										)
									}
									size="sm"
									variant={
										props.state.selectedStatus === status
											? "default"
											: "outline"
									}
								>
									{status}
								</Button>
							))}
						</div>
					</div>

					<Switch
						checked={props.state.favoritesOnly}
						onChange={(checked) => props.setState("favoritesOnly", checked)}
					>
						<div class="flex items-center gap-3">
							<SwitchControl>
								<SwitchThumb />
							</SwitchControl>
							<SwitchLabel>Favorites only</SwitchLabel>
						</div>
					</Switch>

					<SearchFilters
						filterData={props.filterData}
						onSearch={props.onSearch}
						setState={props.setState}
						state={props.state}
					/>
				</div>
			</Show>

			<Show when={props.mode === "pro"}>
				<div class="space-y-4">
					<PresetManager
						advancedQuery={props.advancedQuery}
						currentMode={props.mode}
						currentState={props.state}
						onAction={props.onSearch}
						onLoadPreset={(preset) => {
							props.setState(reconcile(preset.state));
							props.onModeChange(preset.mode);
							props.onAdvancedQueryChange(preset.advancedQuery);
						}}
					/>
					<ProSearchDialog
						onChange={props.onAdvancedQueryChange}
						onSearch={props.onSearch}
						value={props.advancedQuery}
					/>
				</div>
			</Show>
		</div>
	);
}
