import type { PixivBookmarkFilter } from "@solid-imager/core/external-viewer";
import { t } from "@solid-imager/i18n";
import { createQuery } from "@tanstack/solid-query";
import { Show } from "solid-js";
import { Button } from "../button";
import {
	RadioGroup,
	RadioGroupItem,
	RadioGroupItemLabel,
} from "../radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../select";

export function PixivBookmarkFilters(props: {
	filter: PixivBookmarkFilter;
	scope: (string | number)[];
	loadTags: (
		visibility: PixivBookmarkFilter["visibility"],
	) => Promise<string[]>;
	onChange: (filter: PixivBookmarkFilter) => void;
}) {
	const tags = createQuery(() => {
		const visibility = props.filter.visibility;
		return {
			queryKey: ["pixiv", "bookmark-tags", ...props.scope, visibility],
			queryFn: () => props.loadTags(visibility),
			gcTime: 0,
			staleTime: 30_000,
			retry: false,
		};
	});
	const options = () => [
		"",
		...new Set(
			[...(tags.isSuccess ? tags.data : []), props.filter.tag].filter(Boolean),
		),
	];
	const label = (tag: string) => tag || t("pixivBookmarks.allTags");
	return (
		<search
			aria-label={t("pixivBookmarks.filters")}
			class="flex w-full min-w-0 flex-wrap items-end gap-x-4 gap-y-2"
		>
			<RadioGroup
				aria-label={t("pixivBookmarks.visibility")}
				class="flex min-h-12 flex-wrap items-center gap-3"
				value={props.filter.visibility}
				onChange={(visibility) => {
					if (
						visibility !== props.filter.visibility &&
						(visibility === "public" || visibility === "private")
					)
						props.onChange({ visibility, tag: "" });
				}}
			>
				<RadioGroupItem value="public">
					<RadioGroupItemLabel class="flex min-h-12 items-center">
						{t("pixivBookmarks.public")}
					</RadioGroupItemLabel>
				</RadioGroupItem>
				<RadioGroupItem value="private">
					<RadioGroupItemLabel class="flex min-h-12 items-center">
						{t("pixivBookmarks.private")}
					</RadioGroupItemLabel>
				</RadioGroupItem>
			</RadioGroup>
			<div class="min-w-0 flex-1 basis-40 space-y-1">
				<Select
					options={options()}
					value={props.filter.tag}
					onChange={(tag) => {
						if (tag !== null && tag !== props.filter.tag)
							props.onChange({ ...props.filter, tag });
					}}
					itemComponent={(item) => (
						<SelectItem item={item.item}>
							{label(item.item.rawValue)}
						</SelectItem>
					)}
				>
					<SelectLabel>{t("pixivBookmarks.tag")}</SelectLabel>
					<SelectTrigger class="min-h-12 gap-2">
						<SelectValue<string> class="truncate">
							{(state) => label(state.selectedOption() ?? "")}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
			</div>
			<Show when={tags.isPending}>
				<output class="w-full text-muted-foreground text-xs">
					{t("pixivBookmarks.loadingTags")}
				</output>
			</Show>
			<Show when={tags.isError}>
				<div class="flex w-full flex-wrap items-center gap-2">
					<p class="text-sm" role="alert">
						{t("pixivBookmarks.tagsError")}
					</p>
					<Button variant="outline" onClick={() => void tags.refetch()}>
						{t("actions.retry")}
					</Button>
				</div>
			</Show>
		</search>
	);
}
