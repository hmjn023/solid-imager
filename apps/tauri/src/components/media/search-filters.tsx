import type { Author } from "@solid-imager/core/domain/authors/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { SearchState } from "@solid-imager/core/domain/search/schema";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { Badge } from "@solid-imager/ui/badge";
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
import { cn } from "@solid-imager/ui/utils/cn";
import { createSignal, For } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";

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
	const [value] = createSignal<T | null>(null);

	return (
		<div class="space-y-2">
			<Label>{props.label}</Label>
			<div class="mb-2 flex flex-wrap gap-2">
				<For each={props.selectedItems}>
					{(id) => {
						const item = props.items?.find((candidate) => props.getItemKey(candidate) === id) as
							| T
							| undefined;
						return (
							<Badge class="cursor-pointer" variant={props.badgeVariant || "default"}>
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
				onChange={(selected) => {
					if (selected) {
						props.onSelect(selected);
					}
				}}
				optionLabel={props.getItemLabel}
				options={props.items || []}
				optionTextValue={props.getItemLabel}
				optionValue={(item) => props.getItemKey(item)}
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

const getAuthorLabel = (author: Author) =>
	author.accountId ? `${author.name}：(twitter)${author.accountId}` : author.name;

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
		<div class={cn("space-y-4", props.className)}>
			<div class="space-y-2">
				<Label>ファイル名検索</Label>
				<Input
					onInput={(event) => props.setState("searchQuery", event.currentTarget.value)}
					placeholder="ファイル名を入力..."
					type="text"
					value={props.state.searchQuery}
				/>
			</div>

			<FilterSection
				badgeVariant="secondary"
				getItemDescription={(item) => item.description}
				getItemKey={(item) => item.name}
				getItemLabel={(item) => item.name}
				items={props.ips}
				label="IP"
				onRemove={(name) =>
					props.setState(
						"selectedIps",
						props.state.selectedIps.filter((itemName) => itemName !== name),
					)
				}
				onSelect={(item) => {
					if (!props.state.selectedIps.includes(item.name)) {
						props.setState("selectedIps", [...props.state.selectedIps, item.name]);
					}
				}}
				placeholder="IPを検索..."
				selectedItems={props.state.selectedIps}
			/>

			<FilterSection
				badgeVariant="secondary"
				getItemDescription={(item) => item.description}
				getItemKey={(item) => item.name}
				getItemLabel={(item) => item.name}
				items={props.characters}
				label="キャラクター"
				onRemove={(name) =>
					props.setState(
						"selectedCharacters",
						props.state.selectedCharacters.filter((itemName) => itemName !== name),
					)
				}
				onSelect={(item) => {
					if (!props.state.selectedCharacters.includes(item.name)) {
						props.setState("selectedCharacters", [...props.state.selectedCharacters, item.name]);
					}
				}}
				placeholder="キャラクターを検索..."
				selectedItems={props.state.selectedCharacters}
			/>

			<FilterSection
				badgeVariant="default"
				getItemKey={(item) => item.name}
				getItemLabel={(item) => item.name}
				items={props.tags}
				label="タグ (すべて含む)"
				onRemove={removeTag}
				onSelect={(item) => addTag(item.name)}
				placeholder="タグを検索..."
				selectedItems={props.state.selectedTags}
			/>

			<FilterSection
				badgeVariant="destructive"
				getItemKey={(item) => item.name}
				getItemLabel={(item) => item.name}
				items={props.tags}
				label="除外タグ"
				onRemove={removeExcludeTag}
				onSelect={(item) => addExcludeTag(item.name)}
				placeholder="除外タグを検索..."
				selectedItems={props.state.excludeTags}
			/>

			<FilterSection
				badgeVariant="secondary"
				getItemKey={(item) => item.name}
				getItemLabel={getAuthorLabel}
				items={props.authors}
				label="作者"
				onRemove={(name) =>
					props.setState(
						"selectedAuthors",
						props.state.selectedAuthors.filter((itemName) => itemName !== name),
					)
				}
				onSelect={(item) => {
					if (!props.state.selectedAuthors.includes(item.name)) {
						props.setState("selectedAuthors", [...props.state.selectedAuthors, item.name]);
					}
				}}
				placeholder="作者・IDを検索..."
				selectedItems={props.state.selectedAuthors}
			/>

			<FilterSection
				badgeVariant="secondary"
				getItemDescription={(item) => item.description}
				getItemKey={(item) => item.name}
				getItemLabel={(item) => item.name}
				items={props.projects}
				label="プロジェクト"
				onRemove={(name) =>
					props.setState(
						"selectedProjects",
						props.state.selectedProjects.filter((itemName) => itemName !== name),
					)
				}
				onSelect={(item) => {
					if (!props.state.selectedProjects.includes(item.name)) {
						props.setState("selectedProjects", [...props.state.selectedProjects, item.name]);
					}
				}}
				placeholder="プロジェクトを検索..."
				selectedItems={props.state.selectedProjects}
			/>
		</div>
	);
}
