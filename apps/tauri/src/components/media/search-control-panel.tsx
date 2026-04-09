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
import { Textarea } from "@solid-imager/ui/textarea";
import { Show } from "solid-js";
import type { MockMediaStatus, MockSource } from "../../mocks/demo-data";

export type TauriSearchMode = "simple" | "pro";
export type TauriSortBy = "createdAt" | "updatedAt" | "fileName" | "rating";
export type TauriSortOrder = "asc" | "desc";

type SearchControlPanelProps = {
	context: "source" | "global";
	favoritesOnly: boolean;
	mode: TauriSearchMode;
	onModeChange: (mode: TauriSearchMode) => void;
	onFavoritesOnlyChange: (checked: boolean) => void;
	onSearch: () => void;
	onSelectSource?: (id: string) => void;
	onSortByChange: (value: TauriSortBy) => void;
	onSortOrderChange: (value: TauriSortOrder) => void;
	onStatusChange: (status: MockMediaStatus | null) => void;
	onTagToggle: (tag: string) => void;
	onTextQueryChange: (value: string) => void;
	onAdvancedQueryChange: (value: string) => void;
	searchQuery: string;
	selectedSource?: string;
	selectedStatus: MockMediaStatus | null;
	selectedTags: string[];
	sortBy: TauriSortBy;
	sortOrder: TauriSortOrder;
	sources?: MockSource[];
	tags: string[];
	advancedQuery: string;
	class?: string;
};

const sortOptions = [
	{ label: "Created At", value: "createdAt" },
	{ label: "Updated At", value: "updatedAt" },
	{ label: "File Name", value: "fileName" },
	{ label: "Rating", value: "rating" },
];

const sortOrderOptions = [
	{ label: "Descending", value: "desc" },
	{ label: "Ascending", value: "asc" },
];

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

			<div class="grid gap-4">
				<div class="grid gap-2">
					<Label>Sort By</Label>
					<Select
						itemComponent={(itemProps) => (
							<SelectItem item={itemProps.item}>
								{itemProps.item.rawValue.label}
							</SelectItem>
						)}
						onChange={(value) => {
							if (value) {
								props.onSortByChange(value.value as TauriSortBy);
							}
						}}
						options={sortOptions}
						value={sortOptions.find((option) => option.value === props.sortBy)}
					>
						<SelectTrigger>
							<SelectValue>
								{(state) =>
									(state.selectedOption() as { label?: string } | undefined)
										?.label ?? "Sort By"
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</div>

				<div class="grid gap-2">
					<Label>Sort Order</Label>
					<Select
						itemComponent={(itemProps) => (
							<SelectItem item={itemProps.item}>
								{itemProps.item.rawValue.label}
							</SelectItem>
						)}
						onChange={(value) => {
							if (value) {
								props.onSortOrderChange(value.value as TauriSortOrder);
							}
						}}
						options={sortOrderOptions}
						value={sortOrderOptions.find(
							(option) => option.value === props.sortOrder,
						)}
					>
						<SelectTrigger>
							<SelectValue>
								{(state) =>
									(state.selectedOption() as { label?: string } | undefined)
										?.label ?? "Sort Order"
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</div>
			</div>

			<div class="my-4 h-px bg-border" />

			<Show when={props.mode === "simple"}>
				<div class="space-y-4">
					<div class="space-y-2">
						<Label>Quick Search</Label>
						<input
							class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
							onInput={(event) =>
								props.onTextQueryChange(event.currentTarget.value)
							}
							placeholder="file name, author, tag..."
							value={props.searchQuery}
						/>
					</div>

					<div class="space-y-2">
						<Label>Status</Label>
						<div class="flex flex-wrap gap-2">
							{(["queued", "review", "tagged"] as const).map((status) => (
								<Button
									onClick={() =>
										props.onStatusChange(
											props.selectedStatus === status ? null : status,
										)
									}
									size="sm"
									variant={
										props.selectedStatus === status ? "default" : "outline"
									}
								>
									{status}
								</Button>
							))}
						</div>
					</div>

					<div class="space-y-2">
						<Label>Tags</Label>
						<div class="flex flex-wrap gap-2">
							{props.tags.map((tag) => (
								<Button
									onClick={() => props.onTagToggle(tag)}
									size="sm"
									variant={
										props.selectedTags.includes(tag) ? "default" : "outline"
									}
								>
									{tag}
								</Button>
							))}
						</div>
					</div>

					<Switch
						checked={props.favoritesOnly}
						onChange={props.onFavoritesOnlyChange}
					>
						<div class="flex items-center gap-3">
							<SwitchControl>
								<SwitchThumb />
							</SwitchControl>
							<SwitchLabel>Favorites only</SwitchLabel>
						</div>
					</Switch>
				</div>
			</Show>

			<Show when={props.mode === "pro"}>
				<div class="space-y-4">
					<div class="rounded-md border p-4">
						<p class="font-medium text-sm">Preset Manager</p>
						<p class="mt-2 text-muted-foreground text-sm">
							Server 側の preset / advanced condition builder
							の代わりに、ここでは mock JSON condition を編集できます。
						</p>
					</div>
					<div class="space-y-2">
						<Label>Advanced Condition</Label>
						<Textarea
							onInput={(event) =>
								props.onAdvancedQueryChange(event.currentTarget.value)
							}
							rows={8}
							value={props.advancedQuery}
						/>
					</div>
				</div>
			</Show>

			<div class="mt-4">
				<Button class="w-full" onClick={props.onSearch}>
					Search
				</Button>
			</div>
		</div>
	);
}
