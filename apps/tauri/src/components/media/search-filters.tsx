import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
} from "@solid-imager/ui/combobox";
import { Input } from "@solid-imager/ui/input";
import { Label } from "@solid-imager/ui/label";
import { createSignal, For } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import type {
	MockAssociation,
	MockAuthor,
	MockMediaStatus,
} from "../../mocks/demo-data";
import type { TauriSortOption } from "./sort-controls";

export type TauriSearchFilterState = {
	searchQuery: string;
	selectedTags: string[];
	excludeTags: string[];
	selectedProjects: string[];
	selectedIps: string[];
	selectedCharacters: string[];
	selectedAuthors: string[];
	selectedStatus: MockMediaStatus | null;
	favoritesOnly: boolean;
	sortBy: TauriSortOption;
	sortOrder: "asc" | "desc";
};

export type TauriSearchFilterData = {
	tags: string[];
	projects: MockAssociation[];
	ips: MockAssociation[];
	characters: MockAssociation[];
	authors: MockAuthor[];
};

type SearchFiltersProps = {
	state: TauriSearchFilterState;
	setState: SetStoreFunction<TauriSearchFilterState>;
	filterData: TauriSearchFilterData;
	onSearch?: () => void;
	className?: string;
};

type SearchFilterItem = {
	id: string;
	name: string;
	description?: string | null;
};

function FilterSection<T extends SearchFilterItem>(props: {
	label: string;
	items: T[];
	selectedItems: string[];
	onSelect: (item: T) => void;
	onRemove: (id: string) => void;
	getItemLabel?: (item: T) => string;
	placeholder?: string;
	badgeVariant?: "default" | "destructive" | "secondary" | "outline";
}) {
	const [value, setValue] = createSignal<T | null>(null);

	return (
		<div class="space-y-2">
			<Label>{props.label}</Label>
			<div class="mb-2 flex flex-wrap gap-2">
				<For each={props.selectedItems}>
					{(id) => {
						const item = props.items.find((candidate) => candidate.id === id);
						return (
							<Badge
								class="cursor-pointer"
								variant={props.badgeVariant || "default"}
							>
								{item ? (props.getItemLabel?.(item) ?? item.name) : id}
								<button
									class="ml-1 hover:text-red-500"
									onClick={() => props.onRemove(id)}
									type="button"
								>
									×
								</button>
							</Badge>
						);
					}}
				</For>
			</div>
			<Combobox<T>
				itemComponent={(itemProps) => (
					<ComboboxItem item={itemProps.item}>
						<ComboboxItemLabel>{itemProps.item.textValue}</ComboboxItemLabel>
					</ComboboxItem>
				)}
				onChange={(val) => {
					if (val) {
						props.onSelect(val);
						setValue(null);
					}
				}}
				optionLabel={(item) => props.getItemLabel?.(item) ?? item.name}
				options={props.items}
				optionTextValue={(item) => props.getItemLabel?.(item) ?? item.name}
				optionValue={(item) => item.id}
				placeholder={props.placeholder}
				triggerMode="focus"
				value={value()}
			>
				<ComboboxControl>
					<ComboboxInput />
				</ComboboxControl>
				<ComboboxContent class="max-h-[300px]" />
			</Combobox>
		</div>
	);
}

const getAuthorLabel = (author: MockAuthor) =>
	author.accountId ? `${author.name} (${author.accountId})` : author.name;

export function SearchFilters(props: SearchFiltersProps) {
	const addTag = (tagName: string) => {
		if (!props.state.selectedTags.includes(tagName)) {
			props.setState("selectedTags", [...props.state.selectedTags, tagName]);
		}
	};

	const removeTag = (tagName: string) => {
		props.setState(
			"selectedTags",
			props.state.selectedTags.filter((tag) => tag !== tagName),
		);
	};

	const addExcludeTag = (tagName: string) => {
		if (!props.state.excludeTags.includes(tagName)) {
			props.setState("excludeTags", [...props.state.excludeTags, tagName]);
		}
	};

	const removeExcludeTag = (tagName: string) => {
		props.setState(
			"excludeTags",
			props.state.excludeTags.filter((tag) => tag !== tagName),
		);
	};

	return (
		<div class={props.className}>
			<div class="space-y-4">
				<div class="space-y-2">
					<Label>ファイル名検索</Label>
					<Input
						onInput={(event) =>
							props.setState("searchQuery", event.currentTarget.value)
						}
						placeholder="ファイル名を入力..."
						type="text"
						value={props.state.searchQuery}
					/>
				</div>

				<FilterSection
					badgeVariant="secondary"
					items={props.filterData.ips}
					label="IP"
					onRemove={(id) =>
						props.setState(
							"selectedIps",
							props.state.selectedIps.filter((itemId) => itemId !== id),
						)
					}
					onSelect={(item) => {
						if (!props.state.selectedIps.includes(item.id)) {
							props.setState("selectedIps", [
								...props.state.selectedIps,
								item.id,
							]);
						}
					}}
					placeholder="IPを検索..."
					selectedItems={props.state.selectedIps}
				/>

				<FilterSection
					badgeVariant="secondary"
					items={props.filterData.characters}
					label="キャラクター"
					onRemove={(id) =>
						props.setState(
							"selectedCharacters",
							props.state.selectedCharacters.filter((itemId) => itemId !== id),
						)
					}
					onSelect={(item) => {
						if (!props.state.selectedCharacters.includes(item.id)) {
							props.setState("selectedCharacters", [
								...props.state.selectedCharacters,
								item.id,
							]);
						}
					}}
					placeholder="キャラクターを検索..."
					selectedItems={props.state.selectedCharacters}
				/>

				<FilterSection
					badgeVariant="default"
					items={props.filterData.tags.map((tag) => ({ id: tag, name: tag }))}
					label="タグ (すべて含む)"
					onRemove={removeTag}
					onSelect={(item) => addTag(item.name)}
					placeholder="タグを検索..."
					selectedItems={props.state.selectedTags}
				/>

				<FilterSection
					badgeVariant="destructive"
					items={props.filterData.tags.map((tag) => ({ id: tag, name: tag }))}
					label="除外タグ"
					onRemove={removeExcludeTag}
					onSelect={(item) => addExcludeTag(item.name)}
					placeholder="除外タグを検索..."
					selectedItems={props.state.excludeTags}
				/>

				<FilterSection
					badgeVariant="secondary"
					getItemLabel={getAuthorLabel}
					items={props.filterData.authors}
					label="作者"
					onRemove={(id) =>
						props.setState(
							"selectedAuthors",
							props.state.selectedAuthors.filter((itemId) => itemId !== id),
						)
					}
					onSelect={(item) => {
						if (!props.state.selectedAuthors.includes(item.id)) {
							props.setState("selectedAuthors", [
								...props.state.selectedAuthors,
								item.id,
							]);
						}
					}}
					placeholder="作者・IDを検索..."
					selectedItems={props.state.selectedAuthors}
				/>

				<FilterSection
					badgeVariant="secondary"
					items={props.filterData.projects}
					label="プロジェクト"
					onRemove={(id) =>
						props.setState(
							"selectedProjects",
							props.state.selectedProjects.filter((itemId) => itemId !== id),
						)
					}
					onSelect={(item) => {
						if (!props.state.selectedProjects.includes(item.id)) {
							props.setState("selectedProjects", [
								...props.state.selectedProjects,
								item.id,
							]);
						}
					}}
					placeholder="プロジェクトを検索..."
					selectedItems={props.state.selectedProjects}
				/>

				{props.onSearch && (
					<Button class="w-full" onClick={props.onSearch}>
						検索
					</Button>
				)}
			</div>
		</div>
	);
}
