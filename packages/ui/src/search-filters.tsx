import type { Author } from "@solid-imager/core/domain/authors/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { SearchState } from "@solid-imager/core/domain/search/schema";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { createMemo, createSignal, For } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { Badge } from "./badge";
import { Button } from "./button";
import {
	Combobox,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
	VirtualComboboxContent,
} from "./combobox";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "./utils/cn";
import { createDebouncedSignal } from "./utils/debounce";

type SearchFiltersProps = {
	state: SearchState;
	setState: SetStoreFunction<SearchState>;
	tags: TagResponse[] | undefined;
	projects: Project[] | undefined;
	ips: Ip[] | undefined;
	characters: Character[] | undefined;
	authors: Author[] | undefined;
	onSearch?: () => void;
	className?: string;
	usePopover?: boolean;
};

function FilterSection<T>(props: {
	label: string;
	items: T[] | undefined;
	selectedItems: string[];
	onSelect: (item: T) => void;
	onRemove: (id: string) => void;
	getItemKey: (item: T) => string;
	getItemLabel: (item: T) => string;
	getItemDescription?: (item: T) => string | undefined | null;
	placeholder?: string;
	badgeVariant?: "default" | "destructive" | "secondary" | "outline";
}) {
	const [value, _setValue] = createSignal<T | null>(null);
	const [filterText, setFilterText] = createDebouncedSignal("", 150);

	const filteredItems = createMemo(() => {
		const items = props.items;
		if (!items) return [];
		const query = filterText().toLowerCase();
		if (!query) return items;
		return items.filter((item) =>
			props.getItemLabel(item).toLowerCase().includes(query),
		);
	});

	return (
		<div class="space-y-2">
			<Label>{props.label}</Label>
			<div class="mb-2 flex flex-wrap gap-2">
				<For each={props.selectedItems}>
					{(id) => {
						const item = props.items?.find(
							(i) => props.getItemKey(i) === id,
						) as T;
						return (
							<Badge
								class="cursor-pointer"
								variant={props.badgeVariant || "default"}
							>
								{item ? props.getItemLabel(item) : id}
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
					}
				}}
				onInputChange={(text) => setFilterText(text)}
				optionLabel={props.getItemLabel}
				options={filteredItems()}
				optionTextValue={props.getItemLabel}
				optionValue={(item) => props.getItemKey(item)}
				placeholder={props.placeholder}
				triggerMode="focus"
				value={value()}
			>
				<ComboboxControl>
					<ComboboxInput />
				</ComboboxControl>
				<VirtualComboboxContent class="max-h-[300px]" />
			</Combobox>
		</div>
	);
}

const getAuthorLabel = (author: Author) =>
	author.accountId
		? `${author.name}：(twitter)${author.accountId}`
		: author.name;

export function SearchFilters(props: SearchFiltersProps) {
	const addTag = (tagName: string) => {
		if (!props.state.selectedTags.includes(tagName)) {
			props.setState("selectedTags", [...props.state.selectedTags, tagName]);
		}
	};

	const removeTag = (tagName: string) => {
		props.setState(
			"selectedTags",
			props.state.selectedTags.filter((t) => t !== tagName),
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
			props.state.excludeTags.filter((t) => t !== tagName),
		);
	};

	return (
		<div class={cn("space-y-4", props.className)}>
			<div class="space-y-2">
				<Label>ファイル名検索</Label>
				<Input
					onInput={(e) => props.setState("searchQuery", e.currentTarget.value)}
					placeholder="ファイル名を入力..."
					type="text"
					value={props.state.searchQuery}
				/>
			</div>

			<FilterSection
				badgeVariant="secondary"
				getItemDescription={(ip) => ip.description}
				getItemKey={(ip) => ip.name}
				getItemLabel={(ip) => ip.name}
				items={props.ips}
				label="IP"
				onRemove={(name) =>
					props.setState(
						"selectedIps",
						props.state.selectedIps.filter((iName) => iName !== name),
					)
				}
				onSelect={(ip) => {
					if (!props.state.selectedIps.includes(ip.name)) {
						props.setState("selectedIps", [
							...props.state.selectedIps,
							ip.name,
						]);
					}
				}}
				placeholder="IPを検索..."
				selectedItems={props.state.selectedIps}
			/>

			<FilterSection
				badgeVariant="secondary"
				getItemDescription={(char) => char.description}
				getItemKey={(char) => char.name}
				getItemLabel={(char) => char.name}
				items={props.characters}
				label="キャラクター"
				onRemove={(name) =>
					props.setState(
						"selectedCharacters",
						props.state.selectedCharacters.filter((cName) => cName !== name),
					)
				}
				onSelect={(char) => {
					if (!props.state.selectedCharacters.includes(char.name)) {
						props.setState("selectedCharacters", [
							...props.state.selectedCharacters,
							char.name,
						]);
					}
				}}
				placeholder="キャラクターを検索..."
				selectedItems={props.state.selectedCharacters}
			/>

			<FilterSection
				badgeVariant="default"
				getItemKey={(tag) => tag.name}
				getItemLabel={(tag) => tag.name}
				items={props.tags}
				label="タグ (すべて含む)"
				onRemove={(id) => removeTag(id)}
				onSelect={(tag) => addTag(tag.name)}
				placeholder="タグを検索..."
				selectedItems={props.state.selectedTags}
			/>

			<FilterSection
				badgeVariant="destructive"
				getItemKey={(tag) => tag.name}
				getItemLabel={(tag) => tag.name}
				items={props.tags}
				label="除外タグ"
				onRemove={(id) => removeExcludeTag(id)}
				onSelect={(tag) => addExcludeTag(tag.name)}
				placeholder="除外タグを検索..."
				selectedItems={props.state.excludeTags}
			/>

			<FilterSection
				badgeVariant="secondary"
				getItemKey={(author) => author.name}
				getItemLabel={getAuthorLabel}
				items={props.authors}
				label="作者"
				onRemove={(name) =>
					props.setState(
						"selectedAuthors",
						props.state.selectedAuthors.filter((aName) => aName !== name),
					)
				}
				onSelect={(author) => {
					if (!props.state.selectedAuthors.includes(author.name)) {
						props.setState("selectedAuthors", [
							...props.state.selectedAuthors,
							author.name,
						]);
					}
				}}
				placeholder="作者・IDを検索..."
				selectedItems={props.state.selectedAuthors}
			/>

			<FilterSection
				badgeVariant="secondary"
				getItemDescription={(project) => project.description}
				getItemKey={(project) => project.id}
				getItemLabel={(project) => project.name}
				items={props.projects}
				label="プロジェクト"
				onRemove={(name) =>
					props.setState(
						"selectedProjects",
						props.state.selectedProjects.filter((pName) => pName !== name),
					)
				}
				onSelect={(project) => {
					if (!props.state.selectedProjects.includes(project.name)) {
						props.setState("selectedProjects", [
							...props.state.selectedProjects,
							project.name,
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
	);
}
