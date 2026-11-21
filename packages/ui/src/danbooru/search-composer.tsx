import type { ViewerTag } from "@solid-imager/core/external-viewer";
import { t } from "@solid-imager/i18n";
import { createQuery } from "@tanstack/solid-query";
import X from "lucide-solid/icons/x";
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	type JSX,
} from "solid-js";
import { Badge } from "../badge";
import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { createAppShortcut } from "../shortcuts/create-app-shortcut";
import { createDebouncedSignal } from "../utils/debounce";
import { CircleHelp } from "../workspace/icons";
import { SearchComposerField } from "../workspace/search-composer-field";
import {
	completeDanbooruTag,
	danbooruTagCategoryLabels,
	getDanbooruCompletion,
} from "./completion";

export function DanbooruSearchComposer(props: {
	actions?: JSX.Element;
	provider?: "Danbooru" | "pixiv";
	draft: string;
	onDraftChange: (value: string) => void;
	onSubmit: () => void;
	suggestTags: (query: string) => Promise<ViewerTag[]>;
}) {
	let input: HTMLInputElement | undefined;
	createAppShortcut("focusSearch", () => input?.focus());
	const [caret, setCaret] = createSignal(props.draft.length);
	const parts = createMemo(() => {
		if (props.provider !== "pixiv")
			return { prefix: "", active: props.draft, tags: [] as string[] };
		const split = props.draft.match(/^(.*\s)(\S*)$/s);
		return {
			prefix: split?.[1] ?? "",
			active: split?.[2] ?? props.draft,
			tags: (split?.[1] ?? "").trim().split(/\s+/).filter(Boolean),
		};
	});
	const remove = (index: number) => {
		const tags = parts().tags.filter((_, i) => i !== index);
		const next = [...tags, parts().active].filter(Boolean).join(" ");
		props.onDraftChange(next ? next + " " : "");
		setCaret(next.length + 1);
		props.onSubmit();
	};
	const submit = () => {
		if (props.provider === "pixiv" && props.draft.trim())
			props.onDraftChange(props.draft.trim() + " ");
		props.onSubmit();
	};
	const [query, setQuery] = createDebouncedSignal("", 250);
	const token = createMemo(() => getDanbooruCompletion(props.draft, caret()));
	createEffect(() => setQuery(token().query));
	const suggestions = createQuery(() => ({
		queryKey: [
			"external-viewer",
			props.provider ?? "Danbooru",
			"tags",
			query(),
		],
		queryFn: () => props.suggestTags(query()),
		enabled: query().length > 0,
		staleTime: 300_000,
		retry: false,
	}));
	const options = createMemo(() => {
		// Reading pending query data suspends the route and detaches the focused input.
		if (!suggestions.isSuccess || query() !== token().query) return [];
		return (suggestions.data ?? []).map((tag) => ({
			label: tag.name,
			value: tag.name,
			description: [
				danbooruTagCategoryLabels[tag.category ?? -1] ??
					t("pixivArtworkDetail.tags"),
				tag.postCount?.toLocaleString(),
			]
				.filter(Boolean)
				.join(" · "),
		}));
	});
	const searchHelp = () => t("searchComposer.searchHelp");
	const helpDescriptionId = createUniqueId();
	return (
		<div class="flex min-w-0 flex-col gap-2">
			<SearchComposerField
				id="external-search-composer"
				label={
					(props.provider ?? t("sidebar.danbooru")) + t("searchComposer.search")
				}
				draft={parts().active}
				inputRef={(element) => {
					input = element;
				}}
				onDraftChange={(value) => props.onDraftChange(parts().prefix + value)}
				onCaretChange={(value) => setCaret(parts().prefix.length + value)}
				onSelect={(option) => {
					const full = completeDanbooruTag(props.draft, caret(), option.value);
					if (props.provider === "pixiv") {
						props.onDraftChange(full);
						setCaret(full.length);
						return { draft: "", caret: 0 };
					}
					return {
						draft: full,
						caret:
							token().start + token().prefix.length + option.value.length + 1,
					};
				}}
				onEmptyBackspace={() => {
					if (parts().tags.length) remove(parts().tags.length - 1);
				}}
				onSubmit={submit}
				options={options()}
				placeholder={t("searchComposer.enterTags")}
				submitLabel={t("actions.search")}
				status={
					suggestions.isError && query() === token().query
						? t("searchComposer.couldNotLoadTagSuggestionsYouCanStillEnter")
						: undefined
				}
			>
				<For each={parts().tags}>
					{(tag, index) => (
						<Badge variant="secondary" class="max-w-full gap-1 text-sm">
							<span class="break-all">{tag}</span>
							<Button
								type="button"
								variant="ghost"
								class="h-6 w-6 shrink-0 p-0"
								aria-label={t("pixivScreen.removeTag", { tag })}
								onClick={() => remove(index())}
							>
								<X aria-hidden="true" size={12} />
							</Button>
						</Badge>
					)}
				</For>
			</SearchComposerField>
			<div class="flex min-w-0 flex-wrap items-center gap-2">
				{props.actions}
				<Popover placement="bottom-end">
					<PopoverTrigger
						aria-label={searchHelp()}
						as={Button}
						class="size-11 shrink-0"
						size="icon"
						title={searchHelp()}
						type="button"
						variant="outline"
					>
						<CircleHelp aria-hidden="true" />
					</PopoverTrigger>
					<PopoverContent
						aria-describedby={helpDescriptionId}
						aria-label={searchHelp()}
						class="workspace-theme"
					>
						<h2 class="font-semibold text-sm">{searchHelp()}</h2>
						<p
							class="mt-1 text-muted-foreground text-sm"
							id={helpDescriptionId}
						>
							{t(
								props.provider === "pixiv"
									? "searchComposer.pixivHint"
									: "searchComposer.danbooruHint",
							)}
						</p>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
}
