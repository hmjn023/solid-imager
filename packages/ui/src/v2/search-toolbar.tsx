import type { SearchState } from "@solid-imager/core/domain/search/schema";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import ArrowDownUp from "lucide-solid/icons/arrow-down-up";
import ChevronDown from "lucide-solid/icons/chevron-down";
import Filter from "lucide-solid/icons/filter";
import Grid3X3 from "lucide-solid/icons/grid-3-x-3";
import List from "lucide-solid/icons/list";
import Search from "lucide-solid/icons/search";
import X from "lucide-solid/icons/x";
import type { JSX } from "solid-js";
import {
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { Button, buttonVariants } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import type { PresetManagerClient } from "../search-control-panel";
import { SearchControlPanel } from "../search-control-panel";
import { SortControls } from "../sort-controls";
import {
	clearPresetFilters,
	searchState,
	setSearchState,
} from "../stores/search-store";

type SearchArrayKey =
	| "excludeTags"
	| "selectedAuthors"
	| "selectedCharacters"
	| "selectedIps"
	| "selectedProjects"
	| "selectedTags";

type SearchToken = {
	destructive?: boolean;
	key: SearchArrayKey | "searchQuery";
	prefix: string;
	value: string;
};

export type V2SearchToolbarProps = {
	actions?: JSX.Element;
	context: "global" | "source";
	filterData: {
		authors:
			| import("@solid-imager/core/domain/authors/schemas").Author[]
			| undefined;
		characters:
			| import("@solid-imager/core/domain/characters/schemas").Character[]
			| undefined;
		ips: import("@solid-imager/core/domain/ips/schemas").Ip[] | undefined;
		projects:
			| import("@solid-imager/core/domain/projects/schemas").Project[]
			| undefined;
		tags:
			| import("@solid-imager/core/domain/tags/schemas").TagResponse[]
			| undefined;
	};
	itemCount?: number;
	onSearch: () => void;
	onSelectSource?: (id: string) => void;
	presetClient: PresetManagerClient;
	selectedSource?: string;
	sourceName: string;
	sources?: SafeMediaSource[];
};

function parseValues(value: string): string[] {
	return [
		...new Set(
			value
				.split(",")
				.map((part) => part.trim())
				.filter(Boolean),
		),
	];
}

function appendValues(key: SearchArrayKey, rawValue: string) {
	const values = parseValues(rawValue);
	if (values.length === 0) return;
	setSearchState(key, [...new Set([...searchState[key], ...values])]);
}

function removeToken(token: SearchToken) {
	if (token.key === "searchQuery") {
		setSearchState("searchQuery", "");
		return;
	}
	setSearchState(
		token.key,
		searchState[token.key].filter((value) => value !== token.value),
	);
}

function submitComposerDraft(rawDraft: string): boolean {
	const parts = rawDraft.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
	const freeText: string[] = [];
	let changed = false;

	for (const part of parts) {
		const separatorIndex = part.indexOf(":");
		if (separatorIndex < 1) {
			freeText.push(part.replace(/^"|"$/g, ""));
			continue;
		}
		const prefix = part.slice(0, separatorIndex).toLowerCase();
		const value = part
			.slice(separatorIndex + 1)
			.replace(/^"|"$/g, "")
			.trim();
		if (!value) continue;

		switch (prefix) {
			case "name":
				setSearchState("searchQuery", value);
				changed = true;
				break;
			case "tag":
				appendValues("selectedTags", value);
				changed = true;
				break;
			case "-tag":
				appendValues("excludeTags", value);
				changed = true;
				break;
			case "character":
				appendValues("selectedCharacters", value);
				changed = true;
				break;
			case "ip":
				appendValues("selectedIps", value);
				changed = true;
				break;
			case "author":
				appendValues("selectedAuthors", value);
				changed = true;
				break;
			case "project":
				appendValues("selectedProjects", value);
				changed = true;
				break;
			default:
				freeText.push(part);
		}
	}

	if (freeText.length > 0) {
		setSearchState("searchQuery", freeText.join(" "));
		changed = true;
	}
	return changed;
}

function tokensFromState(state: SearchState): SearchToken[] {
	return [
		...(state.searchQuery
			? [
					{
						key: "searchQuery" as const,
						prefix: "name",
						value: state.searchQuery,
					},
				]
			: []),
		...state.selectedTags.map((value) => ({
			key: "selectedTags" as const,
			prefix: "tag",
			value,
		})),
		...state.excludeTags.map((value) => ({
			destructive: true,
			key: "excludeTags" as const,
			prefix: "-tag",
			value,
		})),
		...state.selectedCharacters.map((value) => ({
			key: "selectedCharacters" as const,
			prefix: "character",
			value,
		})),
		...state.selectedIps.map((value) => ({
			key: "selectedIps" as const,
			prefix: "ip",
			value,
		})),
		...state.selectedAuthors.map((value) => ({
			key: "selectedAuthors" as const,
			prefix: "author",
			value,
		})),
		...state.selectedProjects.map((value) => ({
			key: "selectedProjects" as const,
			prefix: "project",
			value,
		})),
	];
}

function sortLabel(state: SearchState): string {
	const labels: Record<SearchState["sortBy"], string> = {
		date: "作成日",
		name: "名前",
		rating: "評価",
		size: "サイズ",
		viewCount: "閲覧数",
	};
	const field = labels[state.sortBy];
	return `${field}・${state.sortOrder === "desc" ? "降順" : "昇順"}`;
}

export function V2SearchToolbar(props: V2SearchToolbarProps) {
	const [draft, setDraft] = createSignal("");
	const [filterOpen, setFilterOpen] = createSignal(false);
	const [sortOpen, setSortOpen] = createSignal(false);
	const tokens = createMemo(() => tokensFromState(searchState));
	let composerInput: HTMLInputElement | undefined;
	const submitDraft = () => {
		if (!submitComposerDraft(draft())) return;
		setDraft("");
		props.onSearch();
	};

	onMount(() => {
		const focusComposer = (event: KeyboardEvent) => {
			const target = event.target;
			const isEditing =
				target instanceof HTMLElement &&
				(target.matches("input, textarea, select") || target.isContentEditable);
			if (
				event.key !== "/" ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey ||
				isEditing
			) {
				return;
			}
			event.preventDefault();
			composerInput?.focus();
		};
		window.addEventListener("keydown", focusComposer);
		onCleanup(() => window.removeEventListener("keydown", focusComposer));
	});

	return (
		<header class="shrink-0 border-[var(--v2-border)] border-b bg-[var(--v2-surface-subtle)] px-3 py-3 sm:px-4">
			<div class="mb-2 flex min-h-6 items-center gap-2 text-sm">
				<span class="text-[var(--v2-text-secondary)]">Library</span>
				<span aria-hidden="true" class="text-[var(--v2-border-strong)]">
					/
				</span>
				<strong class="min-w-0 truncate font-semibold">
					{props.sourceName}
				</strong>
				<Show when={props.itemCount !== undefined}>
					<span class="ml-auto shrink-0 text-xs text-[var(--v2-text-muted)]">
						{props.itemCount?.toLocaleString()} items
					</span>
				</Show>
			</div>
			<div class="flex min-w-0 flex-wrap items-start gap-2">
				<form
					class="relative min-w-[min(16rem,100%)] flex-1"
					onSubmit={(event) => {
						event.preventDefault();
						submitDraft();
					}}
				>
					<Label class="sr-only" for="v2-search-composer">
						メディアを検索
					</Label>
					<Search
						aria-hidden="true"
						class="absolute top-[0.7rem] left-3 z-10 text-[var(--v2-text-muted)]"
						size={16}
					/>
					<div class="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-[var(--v2-border-strong)] bg-white py-1 pr-8 pl-9 focus-within:ring-2 focus-within:ring-[var(--v2-focus)] focus-within:ring-offset-1 sm:min-h-9">
						<For each={tokens().slice(0, 4)}>
							{(token) => (
								<span
									class={`inline-flex h-6 max-w-52 items-center gap-1 rounded px-1.5 font-medium text-[11px] ${token.destructive ? "bg-red-50 text-destructive" : "bg-[var(--v2-surface-selected)] text-[var(--v2-primary)]"}`}
								>
									<span class="truncate">
										{token.prefix}:{token.value}
									</span>
									<button
										aria-label={`${token.prefix}:${token.value}を解除`}
										class="flex size-4 shrink-0 items-center justify-center rounded hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)]"
										onClick={() => {
											removeToken(token);
											props.onSearch();
										}}
										type="button"
									>
										<X aria-hidden="true" size={11} />
									</button>
								</span>
							)}
						</For>
						<Show when={tokens().length > 4}>
							<span class="inline-flex h-6 items-center rounded bg-[var(--v2-surface-muted)] px-2 font-medium text-[11px] text-[var(--v2-text-secondary)]">
								ほか{tokens().length - 4}件
							</span>
						</Show>
						<Input
							class="h-7 min-h-7 min-w-40 flex-1 border-0 bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
							id="v2-search-composer"
							onInput={(event) => setDraft(event.currentTarget.value)}
							placeholder="検索、または tag: / author: / ip: …"
							ref={(element) => {
								composerInput = element;
							}}
							value={draft()}
						/>
					</div>
					<kbd class="absolute top-2 right-2 rounded border border-[var(--v2-border)] bg-[var(--v2-surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--v2-text-muted)]">
						/
					</kbd>
				</form>

				<Popover
					forceMount
					onOpenChange={setFilterOpen}
					open={filterOpen()}
					placement="bottom-end"
				>
					<PopoverTrigger
						aria-label={`検索フィルター、${tokens().length}件の条件`}
						class={buttonVariants({
							class:
								"min-h-11 border-[var(--v2-border-strong)] bg-white px-3 shadow-none sm:min-h-9",
							size: "sm",
							variant: "outline",
						})}
					>
						<Filter aria-hidden="true" size={15} />
						フィルター
						<Show when={tokens().length > 0}>
							<span class="flex min-w-5 items-center justify-center rounded-full bg-[var(--v2-primary)] px-1.5 py-0.5 text-[10px] text-white">
								{tokens().length}
							</span>
						</Show>
					</PopoverTrigger>
					<PopoverContent
						aria-label="検索フィルター"
						class="v2-theme flex max-h-[min(42rem,calc(100dvh-2rem))] w-[min(24rem,calc(100dvw-1.5rem))] flex-col overflow-hidden bg-[var(--v2-surface)] p-0 text-[var(--v2-text)] shadow-xl data-[closed]:hidden data-[expanded]:animate-none"
					>
						<div class="flex items-start justify-between border-[var(--v2-border)] border-b px-4 py-3">
							<div>
								<h2 class="font-semibold text-sm">検索フィルター</h2>
								<p class="mt-0.5 text-[11px] text-[var(--v2-text-muted)]">
									検索バーと同じ条件を編集します
								</p>
							</div>
							<Button
								class="h-7 px-2 text-xs"
								onClick={() => {
									clearPresetFilters();
									props.onSearch();
								}}
								size="sm"
								variant="ghost"
							>
								すべて解除
							</Button>
						</div>
						<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
							<SearchControlPanel
								context={props.context}
								filterData={props.filterData}
								onSearch={props.onSearch}
								onSelectSource={props.onSelectSource}
								presetClient={props.presetClient}
								selectedSource={props.selectedSource}
								showSearchButton={false}
								sources={props.sources}
								usePopover={false}
							/>
						</div>
						<div class="flex shrink-0 justify-end gap-2 border-[var(--v2-border)] border-t bg-white p-3">
							<Button
								onClick={() => setFilterOpen(false)}
								size="sm"
								variant="outline"
							>
								閉じる
							</Button>
							<Button
								disabled={
									searchState.mode === "vector" &&
									!searchState.similarityAnchorMediaId
								}
								onClick={() => {
									props.onSearch();
									setFilterOpen(false);
								}}
								size="sm"
							>
								適用
							</Button>
						</div>
					</PopoverContent>
				</Popover>

				<Popover
					onOpenChange={setSortOpen}
					open={sortOpen()}
					placement="bottom-end"
				>
					<PopoverTrigger
						aria-label={`並び替え、現在は${sortLabel(searchState)}`}
						class={buttonVariants({
							class:
								"min-h-11 border-[var(--v2-border-strong)] bg-white px-3 shadow-none sm:min-h-9",
							size: "sm",
							variant: "outline",
						})}
					>
						<ArrowDownUp aria-hidden="true" size={15} />
						<span class="hidden sm:inline">{sortLabel(searchState)}</span>
						<ChevronDown aria-hidden="true" size={13} />
					</PopoverTrigger>
					<PopoverContent class="v2-theme w-72 p-4 shadow-xl">
						<SortControls
							onSortByChange={(value) => setSearchState("sortBy", value)}
							onSortOrderChange={(value) => setSearchState("sortOrder", value)}
							sortBy={searchState.sortBy}
							sortOrder={searchState.sortOrder}
						/>
					</PopoverContent>
				</Popover>
				<div class="flex rounded-md border border-[var(--v2-border-strong)] bg-white p-0.5">
					<Button
						aria-label="グリッド表示"
						aria-pressed="true"
						class="size-11 bg-[var(--v2-primary)] p-0 text-white hover:bg-[var(--v2-primary-hover)] sm:size-8"
						size="icon"
					>
						<Grid3X3 aria-hidden="true" size={15} />
					</Button>
					<Button
						aria-label="リスト表示（未実装）"
						class="size-11 p-0 sm:size-8"
						disabled
						size="icon"
						title="リスト表示は今後実装予定です"
						variant="ghost"
					>
						<List aria-hidden="true" size={15} />
					</Button>
				</div>
				{props.actions}
			</div>
		</header>
	);
}
