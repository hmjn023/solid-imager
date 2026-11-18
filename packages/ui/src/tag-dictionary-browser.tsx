import {
	canonicalTagName,
	TAG_DICTIONARY_PAGE_SIZE,
	type TagDictionaryDetail,
	type TagDictionaryEntry,
	type TagDictionarySearch,
	type TagDictionarySearchResult,
} from "@solid-imager/core/tags";
import { getLocale, t, type StaticMessageKey } from "@solid-imager/i18n";
import { createQuery } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { ErrorState } from "./async-state";
import { Badge } from "./badge";
import { Button } from "./button";
import {
	TAG_DICTIONARY_DETAIL_QUERY_KEY,
	TAG_DICTIONARY_QUERY_KEY,
} from "./query-options/tags-query";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { TextField, TextFieldInput, TextFieldLabel } from "./text-field";

export type TagDictionaryLookup = {
	dictionarySearch: (
		input: TagDictionarySearch,
		options?: { signal: AbortSignal },
	) => Promise<TagDictionarySearchResult>;
	dictionaryDetail: (
		input: { name: string },
		options?: { signal: AbortSignal },
	) => Promise<TagDictionaryDetail | null>;
};

export function tagDictionaryDetailQuery(
	lookup: TagDictionaryLookup["dictionaryDetail"],
	input: string,
) {
	const name = canonicalTagName(input);
	return {
		queryKey: [...TAG_DICTIONARY_DETAIL_QUERY_KEY, name],
		queryFn: ({ signal }: { signal: AbortSignal }) =>
			lookup({ name }, { signal }),
		enabled: !isServer && name.length > 0 && name.length <= 200,
		staleTime: 60_000,
	};
}

export function plainTagWikiText(body: string) {
	return body.replace(
		/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/gu,
		(_match, tag: string, label?: string) => label || tag,
	);
}

type Category = TagDictionaryEntry["category"];
const CATEGORY_LABELS = {
	0: "labels.general",
	1: "tagDictionary.artist",
	3: "tagDictionary.copyright",
	4: "labels.character",
	5: "tagDictionary.meta",
} satisfies Record<Category, StaticMessageKey>;
const CATEGORIES = (["all", 0, 1, 3, 4, 5] as const).map((category) => ({
	id: String(category),
	category,
}));

function tagCategory(category: Category | "all") {
	return category === "all"
		? t("tagDictionary.allCategories")
		: t(CATEGORY_LABELS[category]);
}

function TagDictionaryDetailView(props: {
	api: TagDictionaryLookup;
	entry: TagDictionaryEntry;
	onAdd?: (entry: TagDictionaryEntry) => void;
	actionLabel?: string;
}) {
	const detail = createQuery(() =>
		tagDictionaryDetailQuery(props.api.dictionaryDetail, props.entry.name),
	);
	const wikiNames = () => detail.data?.wikiNames ?? props.entry.wikiNames;

	return (
		<div class="space-y-3 border-t border-border px-3 py-3 text-sm">
			<div class="flex flex-wrap items-center gap-2">
				<Show when={props.onAdd}>
					{(add) => (
						<Button type="button" size="sm" onClick={() => add()(props.entry)}>
							{props.actionLabel ?? t("tagDictionary.addTag")}
						</Button>
					)}
				</Show>
				<Button
					as="a"
					variant="outline"
					size="sm"
					href={`https://danbooru.donmai.us/wiki_pages/${encodeURIComponent(props.entry.name)}`}
					target="_blank"
					rel="noreferrer"
				>
					{t("tagDictionary.openWiki")}
				</Button>
			</div>
			<dl class="space-y-2 break-words">
				<Show when={props.entry.japanese}>
					{(japanese) => (
						<div>
							<dt class="font-medium">{t("tagDictionary.translation")}</dt>
							<dd>{japanese()}</dd>
						</div>
					)}
				</Show>
				<Show when={wikiNames().length}>
					<div>
						<dt class="font-medium">{t("tagDictionary.wikiNames")}</dt>
						<dd>{wikiNames().join(", ")}</dd>
					</div>
				</Show>
				<Show when={props.entry.aliases.length}>
					<div>
						<dt class="font-medium">{t("tagDictionary.aliases")}</dt>
						<dd>{props.entry.aliases.join(", ")}</dd>
					</div>
				</Show>
				<Show when={props.entry.attributes.length}>
					<div>
						<dt class="font-medium">{t("tagDictionary.attributes")}</dt>
						<dd>{props.entry.attributes.join(" / ")}</dd>
					</div>
				</Show>
			</dl>
			<Show when={detail.isPending}>
				<p class="text-muted-foreground">{t("status.loading")}</p>
			</Show>
			<Show when={detail.isError}>
				<ErrorState
					title={t("tagDictionary.detailError")}
					onRetry={() => void detail.refetch()}
				/>
			</Show>
			<Show when={detail.isSuccess}>
				<Show
					when={detail.data?.body}
					fallback={
						<p class="text-muted-foreground">
							{t("tagDictionary.noDescription")}
						</p>
					}
				>
					{(body) => (
						<div>
							<p class="mb-1 font-medium">
								{t(
									detail.data?.wikiSource === "danbooru"
										? "tagDictionary.liveDescription"
										: "tagDictionary.snapshotDescription",
								)}
							</p>
							<p class="max-h-72 overflow-y-auto whitespace-pre-wrap break-words">
								{plainTagWikiText(body())}
							</p>
						</div>
					)}
				</Show>
			</Show>
		</div>
	);
}

export function TagDictionaryBrowser(props: {
	api: TagDictionaryLookup;
	onAdd?: (entry: TagDictionaryEntry) => void;
	actionLabel?: string;
}) {
	const [draft, setDraft] = createSignal("");
	const [query, setQuery] = createSignal("");
	const [category, setCategory] = createSignal(CATEGORIES[0]);
	const [offset, setOffset] = createSignal(0);
	const [expanded, setExpanded] = createSignal<string>();
	const results = createQuery(() => {
		const filter = category().category;
		const input = {
			query: query(),
			category: filter === "all" ? undefined : filter,
			offset: offset(),
		};
		return {
			queryKey: [...TAG_DICTIONARY_QUERY_KEY, "search", input],
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				props.api.dictionarySearch(input, { signal }),
			enabled: !isServer,
			staleTime: 60_000,
		};
	});
	const goTo = (next: number) => {
		setExpanded(undefined);
		setOffset(next);
	};

	return (
		<div class="min-w-0 space-y-3">
			<form
				class="flex flex-wrap items-end gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					setQuery(draft().trim());
					goTo(0);
				}}
			>
				<TextField value={draft()} onChange={setDraft} class="min-w-0 flex-1">
					<TextFieldLabel>{t("tagDictionary.searchLabel")}</TextFieldLabel>
					<TextFieldInput maxLength={200} type="search" />
				</TextField>
				<Select
					options={CATEGORIES}
					optionValue="id"
					optionTextValue={(option) => tagCategory(option.category)}
					value={category()}
					onChange={(value) => {
						setCategory(value ?? CATEGORIES[0]);
						goTo(0);
					}}
					itemComponent={(item) => (
						<SelectItem item={item.item}>
							{tagCategory(item.item.rawValue.category)}
						</SelectItem>
					)}
				>
					<SelectTrigger aria-label={t("tagDictionary.category")}>
						<SelectValue<(typeof CATEGORIES)[number]>>
							{(state) => tagCategory(state.selectedOption().category)}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
				<Button type="submit" class="min-h-11 sm:min-h-9">
					{t("actions.search")}
				</Button>
			</form>
			<Show when={results.isPending}>
				<p class="text-sm text-muted-foreground">{t("status.loading")}</p>
			</Show>
			<Show when={results.isError}>
				<ErrorState
					title={t("tagDictionary.searchError")}
					onRetry={() => void results.refetch()}
				/>
			</Show>
			<div aria-live="polite" class="text-sm text-muted-foreground">
				<Show when={results.isSuccess && results.data.items.length === 0}>
					{t(
						query() || category().category !== "all"
							? "tagDictionary.noMatches"
							: "tagDictionary.empty",
					)}
				</Show>
			</div>
			<Show when={results.data?.items.length}>
				<ul class="divide-y divide-border rounded-lg border border-border">
					<For each={results.data?.items}>
						{(entry) => (
							<li>
								<Button
									type="button"
									variant="ghost"
									class="min-h-11 w-full justify-between gap-2 px-3 py-2 text-left"
									aria-expanded={expanded() === entry.name}
									onClick={() =>
										setExpanded(
											expanded() === entry.name ? undefined : entry.name,
										)
									}
								>
									<span class="min-w-0 truncate">
										<span class="font-medium">{entry.name}</span>
										<Show when={entry.japanese}>
											<span class="ml-2 text-muted-foreground">
												{entry.japanese}
											</span>
										</Show>
									</span>
									<span class="flex shrink-0 items-center gap-2">
										<Badge variant="secondary">
											{tagCategory(entry.category)}
										</Badge>
										<span class="hidden text-xs text-muted-foreground sm:inline">
											{entry.postCount.toLocaleString(getLocale())}
										</span>
									</span>
								</Button>
								<Show when={expanded() === entry.name}>
									<TagDictionaryDetailView
										api={props.api}
										entry={entry}
										onAdd={props.onAdd}
										actionLabel={props.actionLabel}
									/>
								</Show>
							</li>
						)}
					</For>
				</ul>
			</Show>
			<Show when={offset() > 0 || results.data?.hasMore}>
				<div class="flex justify-between gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={offset() === 0}
						onClick={() => goTo(offset() - TAG_DICTIONARY_PAGE_SIZE)}
					>
						{t("actions.previous")}
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={!results.data?.hasMore}
						onClick={() => goTo(offset() + TAG_DICTIONARY_PAGE_SIZE)}
					>
						{t("actions.next")}
					</Button>
				</div>
			</Show>
		</div>
	);
}
