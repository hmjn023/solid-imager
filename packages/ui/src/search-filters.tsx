import { t } from "@solid-imager/i18n";
import type { Author } from "@solid-imager/core/authors";
import type { Character } from "@solid-imager/core/characters";
import type { Ip } from "@solid-imager/core/ips";
import type { Project } from "@solid-imager/core/projects";
import type { SearchState } from "@solid-imager/core/search";
import type { TagResponse } from "@solid-imager/core/tags";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
	untrack,
} from "solid-js";
import type { StoreSetter } from "solid-js";
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
import { Label } from "./label";
import { TextField, TextFieldInput, TextFieldLabel } from "./text-field";
import { cn } from "./utils/cn";
import { createDebouncedSignal } from "./utils/debounce";

type SearchFiltersProps = {
	state: SearchState;
	setState: StoreSetter<SearchState>;
	tags: TagResponse[] | undefined;
	projects: Project[] | undefined;
	ips: Ip[] | undefined;
	characters: Character[] | undefined;
	authors: Author[] | undefined;
	onSearch?: () => void;
	className?: string;
	usePopover?: boolean;
	filenameResetRevision?: number;
	registerFilenameCommit?: (commit: (() => void) | undefined) => void;
};

function FilterSection<T>(props: {
	label: string;
	items: T[] | undefined;
	selectedItems: string[];
	onSelect: (item: T) => void;
	onRemove: (id: string) => void;
	getItemKey: (item: T) => string;
	getSelectedItemValue?: (item: T) => string;
	getItemLabel: (item: T) => string;
	getItemDescription?: (item: T) => string | undefined | null;
	placeholder?: string;
	badgeVariant?: "default" | "destructive" | "secondary" | "outline";
}) {
	const [value, setValue] = createSignal<T | null>(null);
	const [filterText, setFilterText] = createDebouncedSignal("", 150);
	const filteredItems = createMemo(() => {
		const items = props.items;
		if (!items) return [];
		const query = filterText().toLowerCase();
		if (!query) return items.slice(0, 100);
		return items
			.filter((item) => props.getItemLabel(item).toLowerCase().includes(query))
			.slice(0, 100);
	});

	return (
		<div class="space-y-2">
			<Label>{props.label}</Label>
			<Show when={props.selectedItems.length > 0}>
				<div class="flex flex-wrap gap-2">
					<For each={props.selectedItems}>
						{(id) => {
							const item = props.items?.find(
								(i) =>
									(props.getSelectedItemValue?.(i) ?? props.getItemKey(i)) ===
									id,
							) as T;
							const labelText = () => (item ? props.getItemLabel(item) : id);
							return (
								<Badge variant={props.badgeVariant || "default"}>
									<span>{labelText()}</span>
									<button
										aria-label={t("searchFilters.removeFilterValue", {
											value0: labelText(),
										})}
										class="ml-1 inline-flex size-11 items-center justify-center rounded-full opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-5"
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
			</Show>
			<Combobox<T>
				itemComponent={(itemProps) => (
					<ComboboxItem item={itemProps.item}>
						<ComboboxItemLabel>{itemProps.item.textValue}</ComboboxItemLabel>
					</ComboboxItem>
				)}
				onChange={(val) => {
					if (val) {
						props.onSelect(val);
						setValue(() => val);
						requestAnimationFrame(() => {
							setValue(null);
							setFilterText("");
						});
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
					<ComboboxInput aria-label={props.label} />
				</ComboboxControl>
				<VirtualComboboxContent class="max-h-72" />
			</Combobox>
		</div>
	);
}

const getAuthorLabel = (author: Author) =>
	author.accountId
		? t("searchComposerUtils.valueValue", {
				value0: String(author.name),
				value1: String(author.accountId),
			})
		: author.name;

const FILENAME_DEBOUNCE_MS = 250;

export function SearchFilters(props: SearchFiltersProps) {
	const [filenameDraft, setFilenameDraft] = createSignal(
		untrack(() => props.state.searchQuery),
	);
	let isComposingFilename = false;
	let filenameDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	const cancelFilenameQuery = () => {
		if (filenameDebounceTimer !== undefined) {
			clearTimeout(filenameDebounceTimer);
			filenameDebounceTimer = undefined;
		}
	};

	createEffect(
		() => [props.state.searchQuery, props.filenameResetRevision] as const,
		([externalQuery]) => {
			cancelFilenameQuery();
			if (!isComposingFilename) setFilenameDraft(externalQuery);
		},
	);

	const flushFilenameQuery = (value: string) => {
		cancelFilenameQuery();
		if (props.state.searchQuery !== value) {
			props.setState((draft) => {
				draft.searchQuery = value;
			});
		}
	};

	const scheduleFilenameQuery = (value: string) => {
		cancelFilenameQuery();
		filenameDebounceTimer = setTimeout(() => {
			flushFilenameQuery(value);
		}, FILENAME_DEBOUNCE_MS);
	};

	const commitFilename = () => {
		if (!isComposingFilename) flushFilenameQuery(filenameDraft());
	};
	const registerFilenameCommit = untrack(() => props.registerFilenameCommit);
	registerFilenameCommit?.(commitFilename);
	onCleanup(() => {
		cancelFilenameQuery();
		registerFilenameCommit?.(undefined);
	});

	const addTag = (tagName: string) => {
		if (!props.state.selectedTags.includes(tagName)) {
			props.setState((draft) => {
				draft.selectedTags = [...props.state.selectedTags, tagName];
			});
		}
	};

	const removeTag = (tagName: string) => {
		props.setState((draft) => {
			draft.selectedTags = props.state.selectedTags.filter(
				(t) => t !== tagName,
			);
		});
	};

	const addExcludeTag = (tagName: string) => {
		if (!props.state.excludeTags.includes(tagName)) {
			props.setState((draft) => {
				draft.excludeTags = [...props.state.excludeTags, tagName];
			});
		}
	};

	const removeExcludeTag = (tagName: string) => {
		props.setState((draft) => {
			draft.excludeTags = props.state.excludeTags.filter((t) => t !== tagName);
		});
	};

	return (
		<div class={cn("space-y-4", props.className)}>
			<TextField class="space-y-2">
				<TextFieldLabel>{t("searchFilters.filenameSearch")}</TextFieldLabel>
				<TextFieldInput
					onBlur={commitFilename}
					onCompositionStart={() => {
						isComposingFilename = true;
						cancelFilenameQuery();
					}}
					onCompositionEnd={(e) => {
						isComposingFilename = false;
						const next = e.currentTarget.value;
						setFilenameDraft(next);
						scheduleFilenameQuery(next);
					}}
					onInput={(e) => {
						const next = e.currentTarget.value;
						setFilenameDraft(next);
						if (!isComposingFilename && !e.isComposing) {
							scheduleFilenameQuery(next);
						}
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !isComposingFilename && !e.isComposing) {
							flushFilenameQuery(e.currentTarget.value);
						}
					}}
					placeholder={t("searchFilters.enterAFilename")}
					type="text"
					value={filenameDraft()}
				/>
			</TextField>

			<FilterSection
				badgeVariant="default"
				getItemKey={(tag) => tag.name}
				getItemLabel={(tag) => tag.name}
				items={props.tags}
				label={t("searchFilters.tagsMatchAll")}
				onRemove={(id) => removeTag(id)}
				onSelect={(tag) => addTag(tag.name)}
				placeholder={t("searchFilters.searchTags")}
				selectedItems={props.state.selectedTags}
			/>

			<FilterSection
				badgeVariant="secondary"
				getItemDescription={(ip) => ip.description}
				getItemKey={(ip) => ip.name}
				getItemLabel={(ip) => ip.name}
				items={props.ips}
				label={t("searchFilters.iP")}
				onRemove={(name) =>
					props.setState((draft) => {
						draft.selectedIps = props.state.selectedIps.filter(
							(iName) => iName !== name,
						);
					})
				}
				onSelect={(ip) => {
					if (!props.state.selectedIps.includes(ip.name)) {
						props.setState((draft) => {
							draft.selectedIps = [...props.state.selectedIps, ip.name];
						});
					}
				}}
				placeholder={t("searchFilters.searchIPs")}
				selectedItems={props.state.selectedIps}
			/>

			<FilterSection
				badgeVariant="secondary"
				getItemDescription={(char) => char.description}
				getItemKey={(char) => char.name}
				getItemLabel={(char) => char.name}
				items={props.characters}
				label={t("labels.characters")}
				onRemove={(name) =>
					props.setState((draft) => {
						draft.selectedCharacters = props.state.selectedCharacters.filter(
							(cName) => cName !== name,
						);
					})
				}
				onSelect={(char) => {
					if (!props.state.selectedCharacters.includes(char.name)) {
						props.setState((draft) => {
							draft.selectedCharacters = [
								...props.state.selectedCharacters,
								char.name,
							];
						});
					}
				}}
				placeholder={t("searchFilters.searchCharacters")}
				selectedItems={props.state.selectedCharacters}
			/>

			<FilterSection
				badgeVariant="destructive"
				getItemKey={(tag) => tag.name}
				getItemLabel={(tag) => tag.name}
				items={props.tags}
				label={t("searchFilters.excludedTags")}
				onRemove={(id) => removeExcludeTag(id)}
				onSelect={(tag) => addExcludeTag(tag.name)}
				placeholder={t("searchFilters.searchExcludedTags")}
				selectedItems={props.state.excludeTags}
			/>

			<FilterSection
				badgeVariant="secondary"
				getItemKey={(author) => author.id}
				getItemLabel={getAuthorLabel}
				getSelectedItemValue={(author) => author.name}
				items={props.authors}
				label={t("labels.authors")}
				onRemove={(name) =>
					props.setState((draft) => {
						draft.selectedAuthors = props.state.selectedAuthors.filter(
							(aName) => aName !== name,
						);
					})
				}
				onSelect={(author) => {
					if (!props.state.selectedAuthors.includes(author.name)) {
						props.setState((draft) => {
							draft.selectedAuthors = [
								...props.state.selectedAuthors,
								author.name,
							];
						});
					}
				}}
				placeholder={t("searchFilters.searchAuthorsOrIDs")}
				selectedItems={props.state.selectedAuthors}
			/>

			<FilterSection
				badgeVariant="secondary"
				getItemDescription={(project) => project.description}
				getItemKey={(project) => project.id}
				getItemLabel={(project) => project.name}
				items={props.projects}
				label={t("labels.projects")}
				onRemove={(name) =>
					props.setState((draft) => {
						draft.selectedProjects = props.state.selectedProjects.filter(
							(pName) => pName !== name,
						);
					})
				}
				onSelect={(project) => {
					if (!props.state.selectedProjects.includes(project.name)) {
						props.setState((draft) => {
							draft.selectedProjects = [
								...props.state.selectedProjects,
								project.name,
							];
						});
					}
				}}
				placeholder={t("searchFilters.searchProjects")}
				selectedItems={props.state.selectedProjects}
			/>

			{props.onSearch && (
				<Button class="w-full" onClick={props.onSearch}>
					{t("actions.search")}
				</Button>
			)}
		</div>
	);
}
